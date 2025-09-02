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
			const hasTaskHashtag = contentString.includes('#task');
			const isDoneTask = contentString.includes('#done');
			
			if (hasTaskHashtag && !isDoneTask) {
				// Look for timestamp in the file
				const timestampRegex = /\[20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9](?:\s[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\s(AM|PM))?\]/;
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
		const timestampRegex = /\[20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9](?:\s[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\s(AM|PM))?\]/;
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
			// Preserve long format with time
			const hours12 = newDate.getHours() % 12 || 12;
			const minutes = String(newDate.getMinutes()).padStart(2, '0');
			const seconds = String(newDate.getSeconds()).padStart(2, '0');
			const ampm = newDate.getHours() >= 12 ? 'PM' : 'AM';
			newTimestampString = `[${year}/${month}/${day} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;
		} else {
			// Preserve short format (date-only)
			newTimestampString = `[${year}/${month}/${day}]`;
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
		// Remove brackets and parse the timestamp
		const cleanTimestamp = timestampString.replace(/[\[\]]/g, '');
		
		// Check if this is a date-only format (YYYY/MM/DD) or full format
		if (cleanTimestamp.match(/^20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9]$/)) {
			// Date-only format: assume 12:00 PM (noon)
			const dateComponents = cleanTimestamp.split('/');
			const year = dateComponents[0];
			const month = dateComponents[1];
			const day = dateComponents[2];
			
			// Create date string with noon time
			const dateString = `${month}/${day}/${year} 12:00:00 PM`;
			const date = new Date(dateString);
			
			// Validate the date
			if (isNaN(date.getTime())) {
				return null;
			}
			
			return date;
		} else {
			// Full timestamp format: YYYY/MM/DD HH:MM:SS AM/PM
			const parts = cleanTimestamp.split(' ');
			const datePart = parts[0]; // YYYY/MM/DD
			const timePart = parts[1]; // HH:MM:SS
			const ampm = parts[2]; // AM/PM
			
			const dateComponents = datePart.split('/');
			const year = dateComponents[0];
			const month = dateComponents[1];
			const day = dateComponents[2];
			
			// Reformat to MM/DD/YYYY for Date parsing
			const dateString = `${month}/${day}/${year} ${timePart} ${ampm}`;
			const date = new Date(dateString);
			
			// Validate the date
			if (isNaN(date.getTime())) {
				return null;
			}
			
			return date;
		}
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

	// Add visibility listener to trigger initial scan when user first opens the panel
	let hasScannedOnce = false;
	treeView.onDidChangeVisibility((e) => {
		if (e.visible && !hasScannedOnce) {
			hasScannedOnce = true;
			taskProvider.refresh();
		}
	});

	// Register commands
	const showAllTasksCommand = vscode.commands.registerCommand('task-manager.showAllTasks', () => {
		taskProvider.refresh();
		vscode.window.showInformationMessage('Scanning for all files containing #task...');
	});

	const showTasksDueSoonCommand = vscode.commands.registerCommand('task-manager.showTasksDueSoon', () => {
		taskProvider.refreshDueSoon();
		vscode.window.showInformationMessage('Scanning for tasks due within 3 days...');
	});

	const showTasksOverdueCommand = vscode.commands.registerCommand('task-manager.showTasksOverdue', () => {
		taskProvider.refreshOverdue();
		vscode.window.showInformationMessage('Scanning for overdue tasks...');
	});

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
		
		const timestamp = `[${year}/${month}/${day} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;

		// Insert timestamp at cursor position
		const position = editor.selection.active;
		editor.edit(editBuilder => {
			editBuilder.insert(position, timestamp);
		});

		vscode.window.showInformationMessage(`Timestamp inserted: ${timestamp}`);
	});

	const filterPriorityCommand = vscode.commands.registerCommand('task-manager.filterPriority', async () => {
		const options = [
			{ label: 'All Priorities', value: 'all' },
			{ label: 'Priority 1 (High)', value: 'p1' },
			{ label: 'Priority 2 (Medium)', value: 'p2' },
			{ label: 'Priority 3 (Low)', value: 'p3' }
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select priority filter'
		});

		if (selected) {
			taskProvider.filterByPriority(selected.value);
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
		
		const timestamp = `[${year}/${month}/${day} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;

		// Create task content, with two blank lines because user will want to start editing at beginning of file.
		const taskContent = `\n\n#task ${timestamp} #p3`;

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

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(showAllTasksCommand);
	context.subscriptions.push(showTasksDueSoonCommand);
	context.subscriptions.push(showTasksOverdueCommand);
	context.subscriptions.push(insertTimestampCommand);
	context.subscriptions.push(filterPriorityCommand);
	context.subscriptions.push(newTaskCommand);
	context.subscriptions.push(aboutCommand);
	context.subscriptions.push(addDayCommand);
	context.subscriptions.push(addWeekCommand);
	context.subscriptions.push(addMonthCommand);
	context.subscriptions.push(addYearCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
