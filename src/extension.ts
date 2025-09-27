// The module 'vscode' contains the VS Code extensibility API 
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskProvider } from './model';

/**
 * Finds a folder in the workspace root that matches a wildcard pattern.
 * The wildcard is assumed to be a leading asterisk representing a numeric prefix.
 * @param workspaceRoot The workspace root path
 * @param wildcardPattern The pattern like "*My Tasks"
 * @returns The actual folder name if found, or null if not found
 */
function findFolderByWildcard(workspaceRoot: string, wildcardPattern: string): string | null {
	if (!wildcardPattern.startsWith('*')) {
		return wildcardPattern; // No wildcard, return as-is
	}

	const suffix = wildcardPattern.substring(1); // Remove the leading asterisk
	
	try {
		const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
		
		for (const entry of entries) {
			if (entry.isDirectory() && entry.name.endsWith(suffix)) {
				return entry.name;
			}
		}
	} catch (error) {
		console.error('Error scanning workspace root for wildcard folder:', error);
	}

	return null; // No matching folder found
}

/**
 * Sets up file system watcher for markdown files to automatically update task view
 */
function setupFileWatcher(context: vscode.ExtensionContext, taskProvider: TaskProvider): void {
	// Create a file system watcher for markdown files
	const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
	
	// Handle file saves/changes
	const onChangeDisposable = watcher.onDidChange(async (uri) => {
		try {
			// Small delay to ensure file is fully written
			await new Promise(resolve => setTimeout(resolve, 100));
			
			const filePath = uri.fsPath;
			const content = await vscode.workspace.fs.readFile(uri);
			const contentString = Buffer.from(content).toString('utf8');
			
			// Check if it's a task file
			const primaryHashtag = taskProvider.getPrimaryHashtag();
			const hasTaskHashtag = contentString.includes(primaryHashtag);
			const isDoneTask = contentString.includes('#done');
			
			// Check if task should be included based on completion filter
			let includeTask = false;
			if (hasTaskHashtag) {
				const completionFilter = taskProvider.getCompletionFilter();
				if (completionFilter === 'all') {
					includeTask = true;
				} else if (completionFilter === 'completed') {
					includeTask = isDoneTask;
				} else if (completionFilter === 'not-completed') {
					includeTask = !isDoneTask;
				}
			}
			
			if (includeTask) {
				// Look for timestamp in the file
				// Only support new standard [MM/DD/YYYY] or [MM/DD/YYYY HH:MM:SS AM/PM]
				const timestampRegex = /\[[0-9]{2}\/[0-9]{2}\/20[0-9]{2}(?:\s[0-9]{2}:[0-9]{2}:[0-9]{2}\s(?:AM|PM))?\]/;
				const timestampMatch = contentString.match(timestampRegex);
				
				if (timestampMatch) {
					// File has timestamp - update it efficiently
					await taskProvider.updateSingleTask(filePath, timestampMatch[0]);
				} else {
					// File doesn't have timestamp - do full refresh (rare case)
					taskProvider.refresh();
				}
			} else {
				// File is no longer a task - do full refresh to remove it
				taskProvider.refresh();
			}
		} catch (error) {
			console.error('File watcher error:', error);
			// On error, just ignore - user can manually refresh if needed
		}
	});

	// Add to subscriptions for proper cleanup
	context.subscriptions.push(watcher, onChangeDisposable);
}

/**
 * Adds time to a task's timestamp
 * @param item The tree item containing the task
 * @param amount The amount to add (e.g., 1)
 * @param unit The unit of time ('day', 'week', 'month', 'year')
 * @param taskProvider The task provider instance to refresh after update
 */
async function addTimeToTask(item: any, amount: number, unit: 'day' | 'week' | 'month' | 'year', taskProvider: TaskProvider): Promise<void> {
	if (!item || !item.resourceUri) {
		vscode.window.showErrorMessage('No task selected');
		return;
	}

	const filePath = item.resourceUri.fsPath;
	
	try {
		// Read the file content
		const content = fs.readFileSync(filePath, 'utf8');
		
		// Find existing timestamp
		const timestampRegex = /\[[0-9]{2}\/[0-9]{2}\/20[0-9]{2}(?:\s[0-9]{2}:[0-9]{2}:[0-9]{2}\s(?:AM|PM))?\]/;
		const timestampMatch = content.match(timestampRegex);
		
		if (!timestampMatch) {
			vscode.window.showErrorMessage('No timestamp found in task file');
			return;
		}
		
		const currentTimestampString = timestampMatch[0];
		
		// Detect if the original timestamp was in long format (with time) or short format (date-only)
		const cleanTimestamp = currentTimestampString.replace(/[\[\]]/g, '');
		const isLongFormat = cleanTimestamp.includes(' ') && cleanTimestamp.includes(':');
		
		// Parse the current timestamp
		const parsedDate = parseTimestamp(currentTimestampString);
		if (!parsedDate) {
			vscode.window.showErrorMessage('Unable to parse timestamp');
			return;
		}
		
		// Add the specified amount of time
		const newDate = new Date(parsedDate);
		switch (unit) {
			case 'day':
				newDate.setDate(newDate.getDate() + amount);
				break;
			case 'week':
				newDate.setDate(newDate.getDate() + (amount * 7));
				break;
			case 'month':
				newDate.setMonth(newDate.getMonth() + amount);
				break;
			case 'year':
				newDate.setFullYear(newDate.getFullYear() + amount);
				break;
		}
		
		// Format the new timestamp based on original format
		const year = newDate.getFullYear();
		const month = String(newDate.getMonth() + 1).padStart(2, '0');
		const day = String(newDate.getDate()).padStart(2, '0');
		
		let newTimestampString: string;
		if (isLongFormat) {
			// Preserve long format with time (now standard month-first)
			const hours12 = newDate.getHours() % 12 || 12;
			const minutes = String(newDate.getMinutes()).padStart(2, '0');
			const seconds = String(newDate.getSeconds()).padStart(2, '0');
			const ampm = newDate.getHours() >= 12 ? 'PM' : 'AM';
			newTimestampString = `[${month}/${day}/${year} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;
		} else {
			// Preserve short format (date-only) in new standard
			newTimestampString = `[${month}/${day}/${year}]`;
		}
		
		// Replace the timestamp in the file content
		const newContent = content.replace(currentTimestampString, newTimestampString);
		
		// Write the updated content back to the file
		fs.writeFileSync(filePath, newContent, 'utf8');
		
		// Update just this single task instead of refreshing the entire view
		await taskProvider.updateSingleTask(filePath, newTimestampString);
		
		vscode.window.showInformationMessage(`Added ${amount} ${unit}${amount > 1 ? 's' : ''} to task due date`);
		
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to update task: ${error}`);
	}
}

/**
 * Parses a timestamp string into a Date object
 * @param timestampString The timestamp string to parse
 * @returns Date object or null if parsing failed
 */
function parseTimestamp(timestampString: string): Date | null {
	try {
		const cleanTimestamp = timestampString.replace(/[\[\]]/g, '');
		const parts = cleanTimestamp.split(' ');
		const datePart = parts[0]; // MM/DD/YYYY
		let timePart = '12:00:00';
		let ampmPart = 'PM';
		if (parts.length === 3) {
			timePart = parts[1];
			ampmPart = parts[2];
		}
		const comps = datePart.split('/');
		if (comps.length !== 3 || comps[2].length !== 4) {
			return null;
		}
		const month = comps[0];
		const day = comps[1];
		const year = comps[2];
		const dateString = `${month}/${day}/${year} ${timePart} ${ampmPart}`;
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			return null;
		}
		return date;
	} catch (error) {
		console.error(`Error parsing timestamp ${timestampString}:`, error);
		return null;
	}
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Tasks extension is now active!'); 

	// Create the tree data provider
	const taskProvider = new TaskProvider();
	
	// Register the tree view
	const treeView = vscode.window.createTreeView('taskExplorer', {
		treeDataProvider: taskProvider
	});

	// Set the tree view reference in the provider
	taskProvider.setTreeView(treeView);



	// Set up file watcher for automatic updates
	setupFileWatcher(context, taskProvider);

	// Set up configuration change listener to clear primary hashtag cache
	const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('task-manager.primaryHashtag')) {
			taskProvider.clearPrimaryHashtagCache();
			// Refresh the task view to reflect the new primary hashtag
			taskProvider.refresh();
		}
	});
	context.subscriptions.push(configChangeListener);

	// Add visibility listener to trigger initial scan when user first opens the panel
	let hasScannedOnce = false;
	treeView.onDidChangeVisibility((e) => {
		if (e.visible && !hasScannedOnce) {
			hasScannedOnce = true;
			taskProvider.refresh();
		}
	});

	// Register commands

	const insertTimestampCommand = vscode.commands.registerCommand('task-manager.insertTimestamp', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		// Generate current timestamp in the required format
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours12 = now.getHours() % 12 || 12;
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
		
		const timestamp = `[${month}/${day}/${year} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;

		// Insert timestamp at cursor position
		const position = editor.selection.active;
		editor.edit(editBuilder => {
			editBuilder.insert(position, timestamp);
		});

		vscode.window.showInformationMessage(`Timestamp inserted: ${timestamp}`);
	});

	const selectPrimaryHashtagCommand = vscode.commands.registerCommand('task-manager.selectPrimaryHashtag', async () => {
		// Get current configuration
		const config = vscode.workspace.getConfiguration('task-manager');
		const currentPrimaryHashtag = config.get<string>('primaryHashtag', '#task');
		const hashtagsString = config.get<string>('hashtags', '#task, #todo, #note');
		
		// Parse hashtags from comma-delimited string
		const hashtags = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
		
		// Create options with checkmarks for current selection
		const options = hashtags.map(hashtag => ({
			label: `${hashtag === currentPrimaryHashtag ? '$(check)' : '$(circle-outline)'} ${hashtag}`,
			value: hashtag
		}));

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select primary hashtag for task identification'
		});

		if (selected) {
			try {
				// Update the primary hashtag configuration
				await config.update('primaryHashtag', selected.value, vscode.ConfigurationTarget.Workspace);
				
				// Clear the cached primary hashtag to force reload
				taskProvider.clearPrimaryHashtagCache();
				
				// Refresh the task view to reflect the new primary hashtag
				taskProvider.refresh();
				
				vscode.window.showInformationMessage(`Primary hashtag set to: ${selected.value}`);
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to update primary hashtag: ${err}`);
			}
		}
	});

	const filterPriorityCommand = vscode.commands.registerCommand('task-manager.filterPriority', async () => {
		// Get current filter states to show checkmarks
		const currentPriority = taskProvider.getCurrentPriorityFilter();
		const currentView = taskProvider.getCurrentViewFilter();
		const completionFilter = taskProvider.getCompletionFilter();

		const options = [
			// Priority group
			{ 
				label: `${currentPriority === 'all' ? '$(check) All Priorities' : '$(circle-outline) All Priorities'}`, 
				value: 'priority:all' 
			},
			{ 
				label: `${currentPriority === 'p1' ? '$(check) Priority 1 (High)' : '$(circle-outline) Priority 1 (High)'}`, 
				value: 'priority:p1' 
			},
			{ 
				label: `${currentPriority === 'p2' ? '$(check) Priority 2 (Medium)' : '$(circle-outline) Priority 2 (Medium)'}`, 
				value: 'priority:p2' 
			},
			{ 
				label: `${currentPriority === 'p3' ? '$(check) Priority 3 (Low)' : '$(circle-outline) Priority 3 (Low)'}`, 
				value: 'priority:p3' 
			},
			// Separator
			{ label: '', value: 'separator', kind: vscode.QuickPickItemKind.Separator } as any,
			// View group
			{ 
				label: `${currentView === 'All' ? '$(check) All Tasks' : '$(circle-outline) All Tasks'}`, 
				value: 'view:All' 
			},
			{ 
				label: `${currentView === 'Due Soon' ? '$(check) Due Soon' : '$(circle-outline) Due Soon'}`, 
				value: 'view:Due Soon' 
			},
			{ 
				label: `${currentView === 'Overdue' ? '$(check) Overdue' : '$(circle-outline) Overdue'}`, 
				value: 'view:Overdue' 
			},
			// Second separator
			{ label: '', value: 'separator2', kind: vscode.QuickPickItemKind.Separator } as any,
			// Completion group
			{ 
				label: `${completionFilter === 'all' ? '$(check) All Completions' : '$(circle-outline) All Completions'}`, 
				value: 'completion:all' 
			},
			{ 
				label: `${completionFilter === 'completed' ? '$(check) Completed' : '$(circle-outline) Completed'}`, 
				value: 'completion:completed' 
			},
			{ 
				label: `${completionFilter === 'not-completed' ? '$(check) Not Completed' : '$(circle-outline) Not Completed'}`, 
				value: 'completion:not-completed' 
			}
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select filter options'
		});

		if (selected && selected.value !== 'separator' && selected.value !== 'separator2') {
			const [type, value] = selected.value.split(':');
			if (type === 'priority') {
				taskProvider.filterByPriority(value);
			} else if (type === 'view') {
				if (value === 'All') {
					taskProvider.refresh();
				} else if (value === 'Due Soon') {
					taskProvider.refreshDueSoon();
				} else if (value === 'Overdue') {
					taskProvider.refreshOverdue();
				}
			} else if (type === 'completion') {
				if (value === 'all' || value === 'completed' || value === 'not-completed') {
					taskProvider.setCompletionFilter(value as 'all' | 'completed' | 'not-completed');
				}
			}
		}
	});

	const searchTasksCommand = vscode.commands.registerCommand('task-manager.searchTasks', async () => {
		const searchQuery = await vscode.window.showInputBox({
			placeHolder: 'Enter search text...',
			prompt: 'Search task filenames and content',
			value: ''
		});

		if (searchQuery !== undefined) {
			if (searchQuery.trim() === '') {
				// Clear search if empty string
				taskProvider.clearSearch();
				vscode.window.showInformationMessage('Search cleared');
			} else {
				// Perform search
				taskProvider.searchTasks(searchQuery.trim());
				vscode.window.showInformationMessage(`Searching for: "${searchQuery.trim()}"`);
			}
		}
	});

	const newTaskCommand = vscode.commands.registerCommand('task-manager.newTask', async () => {
		// Get the workspace folder
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const rootPath = workspaceFolder.uri.fsPath;

		// Get configured task folder
		const config = vscode.workspace.getConfiguration('task-manager');
		const taskFolderSetting = config.get<string>('newTaskFolder', '');
		
		// Determine the target folder
		let targetPath = rootPath;
		if (taskFolderSetting && taskFolderSetting.trim() !== '') {
			const folderPattern = taskFolderSetting.trim();
			
			// Handle wildcard patterns
			let actualFolderName: string | null;
			if (folderPattern.startsWith('*')) {
				actualFolderName = findFolderByWildcard(rootPath, folderPattern);
				if (!actualFolderName) {
					vscode.window.showErrorMessage(`No folder found matching pattern: ${folderPattern}`);
					return;
				}
			} else {
				actualFolderName = folderPattern;
			}
			
			targetPath = path.join(rootPath, actualFolderName);
			
			// Create the folder if it doesn't exist (only for non-wildcard folders)
			if (!folderPattern.startsWith('*') && !fs.existsSync(targetPath)) {
				try {
					fs.mkdirSync(targetPath, { recursive: true });
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to create task folder: ${error}`);
					return;
				}
			} else if (folderPattern.startsWith('*') && !fs.existsSync(targetPath)) {
				vscode.window.showErrorMessage(`Wildcard folder not found: ${actualFolderName}`);
				return;
			}
		}

		// Find next available task number
		let taskNumber = 1;
		let fileName = `task-${taskNumber.toString().padStart(4, '0')}.md`;
		let filePath = path.join(targetPath, fileName);

		while (fs.existsSync(filePath)) {
			taskNumber++;
			fileName = `task-${taskNumber.toString().padStart(4, '0')}.md`;
			filePath = path.join(targetPath, fileName);
		}

		// Generate timestamp
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours12 = now.getHours() % 12 || 12;
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
		
		const timestamp = `[${month}/${day}/${year} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;

		// Create task content, with two blank lines because user will want to start editing at beginning of file.
		const primaryHashtag = taskProvider.getPrimaryHashtag();
		const taskContent = `\n\n${primaryHashtag} ${timestamp} #p3`;

		try {
			// Write the file
			fs.writeFileSync(filePath, taskContent, 'utf8');
			
			// Open the file in the editor
			const fileUri = vscode.Uri.file(filePath);
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);

			// Refresh the task view
			taskProvider.refresh();

			vscode.window.showInformationMessage(`New task created: ${fileName}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create task file: ${error}`);
		}
	});

	const aboutCommand = vscode.commands.registerCommand('task-manager.about', async () => {
		const repoUrl = 'https://github.com/Clay-Ferguson/tasks';
		try {
			await vscode.env.openExternal(vscode.Uri.parse(repoUrl));
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open URL: ${error}`);
		}
	});

	// Command to quickly configure the folder used for new tasks
	const configureNewTaskFolderCommand = vscode.commands.registerCommand('task-manager.configureNewTaskFolder', async () => {
		// Read current value
		const config = vscode.workspace.getConfiguration('task-manager');
		const current = config.get<string>('newTaskFolder', '');

		const value = await vscode.window.showInputBox({
			value: current,
			placeHolder: 'Enter folder relative to workspace root (blank = root). Supports optional leading * wildcard.',
			prompt: 'Folder where new task files will be created. Will be created if it does not exist (except wildcard).'
		});

		if (value === undefined) {
			return; // user cancelled
		}

		try {
			await config.update('newTaskFolder', value.trim(), vscode.ConfigurationTarget.Workspace);
			vscode.window.showInformationMessage(value.trim() === '' ? 'New tasks will now be created in the workspace root.' : `New tasks will now be created in "${value.trim()}".`);
		} catch (err) {
			vscode.window.showErrorMessage(`Failed to update setting: ${err}`);
		}
	});

	// Command to configure hashtags
	const configureHashtagsCommand = vscode.commands.registerCommand('task-manager.configureHashtags', async () => {
		// Read current value
		const config = vscode.workspace.getConfiguration('task-manager');
		const current = config.get<string>('hashtags', '#task, #todo, #note');

		const value = await vscode.window.showInputBox({
			value: current,
			placeHolder: 'Enter comma-separated hashtags (e.g., #task, #todo, #note)',
			prompt: 'Hashtags that can be used to identify task files. Separate multiple hashtags with commas.'
		});

		if (value === undefined) {
			return; // user cancelled
		}

		try {
			await config.update('hashtags', value.trim(), vscode.ConfigurationTarget.Workspace);
			vscode.window.showInformationMessage(`Hashtags updated to: "${value.trim()}"`);
		} catch (err) {
			vscode.window.showErrorMessage(`Failed to update hashtags setting: ${err}`);
		}
	});

	// Date extension commands
	const addDayCommand = vscode.commands.registerCommand('task-manager.addDay', async (item) => {
		await addTimeToTask(item, 1, 'day', taskProvider);
	});

	const addWeekCommand = vscode.commands.registerCommand('task-manager.addWeek', async (item) => {
		await addTimeToTask(item, 1, 'week', taskProvider);
	});

	const addMonthCommand = vscode.commands.registerCommand('task-manager.addMonth', async (item) => {
		await addTimeToTask(item, 1, 'month', taskProvider);
	});

	const addYearCommand = vscode.commands.registerCommand('task-manager.addYear', async (item) => {
		await addTimeToTask(item, 1, 'year', taskProvider);
	});

	const deleteTaskCommand = vscode.commands.registerCommand('task-manager.deleteTask', async (item) => {
		if (!item || !item.resourceUri) {
			vscode.window.showErrorMessage('No task selected');
			return;
		}

		const filePath = item.resourceUri.fsPath;
		const fileName = path.basename(filePath);
		
		// Show confirmation dialog
		const answer = await vscode.window.showWarningMessage(
			`Are you sure you want to delete the task file "${fileName}"?`,
			{ modal: true },
			'Delete',
			'Cancel'
		);

		if (answer === 'Delete') {
			try {
				// Delete the file
				await fs.promises.unlink(filePath);
				
				// Refresh the task view to remove the deleted item
				taskProvider.refresh();
				
				vscode.window.showInformationMessage(`Task file "${fileName}" has been deleted.`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to delete task file: ${error}`);
			}
		}
	});

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(insertTimestampCommand);
	context.subscriptions.push(selectPrimaryHashtagCommand);
	context.subscriptions.push(filterPriorityCommand);
	context.subscriptions.push(searchTasksCommand);
	context.subscriptions.push(newTaskCommand);
	context.subscriptions.push(aboutCommand);
	context.subscriptions.push(configureNewTaskFolderCommand);
	context.subscriptions.push(configureHashtagsCommand);
	context.subscriptions.push(addDayCommand);
	context.subscriptions.push(addWeekCommand);
	context.subscriptions.push(addMonthCommand);
	context.subscriptions.push(addYearCommand);
	context.subscriptions.push(deleteTaskCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
