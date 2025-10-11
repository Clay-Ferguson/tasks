// The module 'vscode' contains the VS Code extensibility API 
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskProvider } from './model';
import { containsAnyConfiguredHashtag, getIncludeGlobPattern } from './utils';
import { parseTimestamp, formatTimestamp, TIMESTAMP_REGEX } from './pure-utils';
import { ViewFilter, PriorityTag, CompletionFilter } from './constants';

/**
 * Sets up file system watcher for markdown files to automatically update task view
 */
function setupFileWatcher(context: vscode.ExtensionContext, taskProvider: TaskProvider): void {
	// Create a file system watcher for configured markdown include globs
	const watcherPattern = getIncludeGlobPattern();
	const watcher = vscode.workspace.createFileSystemWatcher(watcherPattern);

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
			const hasTaskHashtag = primaryHashtag === 'all-tags'
				? containsAnyConfiguredHashtag(contentString)
				: contentString.includes(primaryHashtag);
			const isDoneTask = contentString.includes('#done');

			// Check if task should be included based on completion filter
			let includeTask = false;
			if (hasTaskHashtag) {
				const completionFilter = taskProvider.getCompletionFilter();
				if (completionFilter === CompletionFilter.Any) {
					includeTask = true;
				} else if (completionFilter === CompletionFilter.Completed) {
					includeTask = isDoneTask;
				} else if (completionFilter === CompletionFilter.NotCompleted) {
					includeTask = !isDoneTask;
				}
			}

			if (includeTask) {
				// Look for timestamp in the file
				// Only support new standard [MM/DD/YYYY] or [MM/DD/YYYY HH:MM:SS AM/PM]
				const timestampMatch = contentString.match(TIMESTAMP_REGEX);

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
		const timestampMatch = content.match(TIMESTAMP_REGEX);

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
		const newTimestampString = formatTimestamp(newDate, isLongFormat);

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

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Timex extension is now active!');

	// Create the tree data provider with context for state persistence
	const taskProvider = new TaskProvider(context);

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
		if (event.affectsConfiguration('timex.primaryHashtag')) {
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

	const insertTimestampCommand = vscode.commands.registerCommand('timex.insertTimestamp', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		// Generate current timestamp in the required format
		const now = new Date();
		const timestamp = formatTimestamp(now);

		// Insert timestamp at cursor position
		const position = editor.selection.active;
		editor.edit(editBuilder => {
			editBuilder.insert(position, timestamp);
		});

		vscode.window.showInformationMessage(`Timestamp inserted: ${timestamp}`);
	});

	const selectPrimaryHashtagCommand = vscode.commands.registerCommand('timex.selectPrimaryHashtag', async () => {
		// Get current primary hashtag from task provider (which handles runtime overrides)
		const currentPrimaryHashtag = taskProvider.getPrimaryHashtag();

		// Get configuration for available hashtags
		const config = vscode.workspace.getConfiguration('timex');
		const hashtagsString = config.get<string>('hashtags', '#task, #todo, #note');

		// Parse hashtags from comma-delimited string
		const hashtags = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

		// Create options with "all-tags" at the top, then individual hashtags
		const allHashtagsOption = {
			label: `${currentPrimaryHashtag === 'all-tags' ? '$(check)' : '$(circle-outline)'} Any Hashtag`,
			value: 'all-tags'
		};

		// Create options with checkmarks for current selection
		const hashtagOptions = hashtags.map(hashtag => ({
			label: `${hashtag === currentPrimaryHashtag ? '$(check)' : '$(circle-outline)'} ${hashtag}`,
			value: hashtag
		}));

		// Combine all options with "all-tags" first
		const options = [allHashtagsOption, ...hashtagOptions];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select primary hashtag for task identification'
		});

		if (selected) {
			try {
				if (selected.value === 'all-tags') {
					// Set runtime override for all-tags mode
					taskProvider.setPrimaryHashtagOverride('all-tags');
				} else {
					// Clear runtime override and update workspace configuration for specific hashtag
					taskProvider.setPrimaryHashtagOverride(null);
					await config.update('primaryHashtag', selected.value, vscode.ConfigurationTarget.Workspace);

					// Clear the cached primary hashtag to force reload from config
					taskProvider.clearPrimaryHashtagCache();
				}

				// Refresh the task view to reflect the new primary hashtag
				taskProvider.refresh();

				// vscode.window.showInformationMessage(`Primary hashtag set to: ${selected.value}`);
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to update primary hashtag: ${err}`);
			}
		}
	});

	const filterPriorityCommand = vscode.commands.registerCommand('timex.filterPriority', async () => {
		// Get current filter states to show checkmarks
		const currentPriority = taskProvider.getCurrentPriorityFilter();
		const currentView = taskProvider.getCurrentViewFilter();
		const completionFilter = taskProvider.getCompletionFilter();
		const div = '––––––––––'; // visual divider
		const options = [
			// Priority group
			{
				label: `${currentPriority === PriorityTag.Any ? `$(check) ${div} Any Priority ${div}` : `$(circle-outline) ${div} Any Priority ${div}`}`,
				value: `priority:${PriorityTag.Any}`
			},
			{
				label: `${currentPriority === PriorityTag.High ? '$(check) Priority 1' : '$(circle-outline) Priority 1'}`,
				value: `priority:${PriorityTag.High}`
			},
			{
				label: `${currentPriority === PriorityTag.Medium ? '$(check) Priority 2' : '$(circle-outline) Priority 2'}`,
				value: `priority:${PriorityTag.Medium}`
			},
			{
				label: `${currentPriority === PriorityTag.Low ? '$(check) Priority 3' : '$(circle-outline) Priority 3'}`,
				value: `priority:${PriorityTag.Low}`
			},
			// Separator
			{ label: '', value: 'separator', kind: vscode.QuickPickItemKind.Separator } as any,
			// View group
			{
				label: `${currentView === ViewFilter.All ? `$(check) ${div} Any Time ${div}` : `$(circle-outline) ${div} Any Time ${div}`}`,
				value: `view:${ViewFilter.All}`
			},
			{
				label: `${currentView === ViewFilter.DueSoon ? `$(check) ${ViewFilter.DueSoon}` : `$(circle-outline) ${ViewFilter.DueSoon}`}`,
				value: `view:${ViewFilter.DueSoon}`
			},
			{
				label: `${currentView === ViewFilter.DueToday ? `$(check) ${ViewFilter.DueToday}` : `$(circle-outline) ${ViewFilter.DueToday}`}`,
				value: `view:${ViewFilter.DueToday}`
			},
			{
				label: `${currentView === ViewFilter.FutureDueDates ? `$(check) ${ViewFilter.FutureDueDates}` : `$(circle-outline) ${ViewFilter.FutureDueDates}`}`,
				value: `view:${ViewFilter.FutureDueDates}`
			},
			{
				label: `${currentView === ViewFilter.Overdue ? `$(check) ${ViewFilter.Overdue}` : `$(circle-outline) ${ViewFilter.Overdue}`}`,
				value: `view:${ViewFilter.Overdue}`
			},
			// Second separator
			{ label: '', value: 'separator2', kind: vscode.QuickPickItemKind.Separator } as any,
			// Completion group
			{
				label: `${completionFilter === CompletionFilter.Any ? `$(check) ${div} Any Completion ${div}` : `$(circle-outline) ${div} Any Completion ${div}`}`,
				value: `completion:${CompletionFilter.Any}`
			},
			{
				label: `${completionFilter === CompletionFilter.Completed ? '$(check) Done' : '$(circle-outline) Done'}`,
				value: `completion:${CompletionFilter.Completed}`
			},
			{
				label: `${completionFilter === CompletionFilter.NotCompleted ? '$(check) Not Done' : '$(circle-outline) Not Done'}`,
				value: `completion:${CompletionFilter.NotCompleted}`
			}
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select filter options'
		});

		if (selected && selected.value !== 'separator' && selected.value !== 'separator2') {
			const [type, value] = selected.value.split(':');
			if (type === 'priority') {
				taskProvider.filterByPriority(value as PriorityTag);
			} else if (type === 'view') {
				const viewValue = value as ViewFilter;
				switch (viewValue) {
					case ViewFilter.All:
						taskProvider.refresh();
						break;
					case ViewFilter.DueSoon:
						taskProvider.refreshDueSoon();
						break;
					case ViewFilter.DueToday:
						taskProvider.refreshDueToday();
						break;
					case ViewFilter.FutureDueDates:
						taskProvider.refreshFutureDueDates();
						break;
					case ViewFilter.Overdue:
						taskProvider.refreshOverdue();
						break;
					default:
						break;
				}
			} else if (type === 'completion') {
				if (value === CompletionFilter.Any || value === CompletionFilter.Completed || value === CompletionFilter.NotCompleted) {
					taskProvider.setCompletionFilter(value as CompletionFilter);
				}
			}
		}
	});

	const searchTasksCommand = vscode.commands.registerCommand('timex.searchTasks', async () => {
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

	const newTaskCommand = vscode.commands.registerCommand('timex.newTask', async () => {
		// Get the workspace folder
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const rootPath = workspaceFolder.uri.fsPath;

		// Get configured task folder
		const config = vscode.workspace.getConfiguration('timex');
		const taskFolderSetting = config.get<string>('newTaskFolder', '');

		// Determine the target folder
		let targetPath = rootPath;
		if (taskFolderSetting && taskFolderSetting.trim() !== '') {
			const folderPath = taskFolderSetting.trim();
			
			// Check if it's an absolute path
			if (path.isAbsolute(folderPath)) {
				targetPath = folderPath;
			} else {
				// If relative path, join with workspace root (backward compatibility)
				targetPath = path.join(rootPath, folderPath);
			}

			// Create the folder if it doesn't exist
			if (!fs.existsSync(targetPath)) {
				try {
					fs.mkdirSync(targetPath, { recursive: true });
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to create task folder: ${error}`);
					return;
				}
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
		const timestamp = formatTimestamp(now);

		// Create task content, with two blank lines because user will want to start editing at beginning of file.
		const primaryHashtag = taskProvider.getPrimaryHashtag();
		// If in "all-tags" mode, use the first configured hashtag instead of "all-tags"
		let hashtagToUse = primaryHashtag;
		if (primaryHashtag === 'all-tags') {
			const config = vscode.workspace.getConfiguration('timex');
			const hashtagsString = config.get<string>('hashtags', '#task, #todo, #note');
			const hashtags = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
			hashtagToUse = hashtags.length > 0 ? hashtags[0] : '#task'; // fallback to #task if no hashtags configured
		}
		const taskContent = `\n\n${hashtagToUse} ${timestamp} #${PriorityTag.Low}`;

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

	const aboutCommand = vscode.commands.registerCommand('timex.about', async () => {
		try {
			// Get the path to the README.md in the extension's installation directory
			const extensionPath = context.extensionPath;
			const readmePath = vscode.Uri.file(path.join(extensionPath, 'README.md'));

			// Open the README.md file in VS Code's markdown preview
			await vscode.commands.executeCommand('markdown.showPreview', readmePath);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open About page: ${error}`);
		}
	});

	const openSettingsCommand = vscode.commands.registerCommand('timex.openSettings', async () => {
		try {
			await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Clay-Ferguson.timex');
		} catch (err) {
			vscode.window.showErrorMessage(`Failed to open Timex settings: ${err}`);
		}
	});

	// Clear all filters command
	const clearFiltersCommand = vscode.commands.registerCommand('timex.clearFilters', async () => {
		taskProvider.clearFilters();
		vscode.window.showInformationMessage('All filters cleared');
	});

	// Date extension commands
	const addDayCommand = vscode.commands.registerCommand('timex.addDay', async (item) => {
		await addTimeToTask(item, 1, 'day', taskProvider);
	});

	const addWeekCommand = vscode.commands.registerCommand('timex.addWeek', async (item) => {
		await addTimeToTask(item, 1, 'week', taskProvider);
	});

	const addMonthCommand = vscode.commands.registerCommand('timex.addMonth', async (item) => {
		await addTimeToTask(item, 1, 'month', taskProvider);
	});

	const addYearCommand = vscode.commands.registerCommand('timex.addYear', async (item) => {
		await addTimeToTask(item, 1, 'year', taskProvider);
	});

	const deleteTaskCommand = vscode.commands.registerCommand('timex.deleteTask', async (item) => {
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
	context.subscriptions.push(openSettingsCommand);
	context.subscriptions.push(clearFiltersCommand);
	context.subscriptions.push(addDayCommand);
	context.subscriptions.push(addWeekCommand);
	context.subscriptions.push(addMonthCommand);
	context.subscriptions.push(addYearCommand);
	context.subscriptions.push(deleteTaskCommand);
}

// This method is called when your extension is deactivated
export function deactivate() { }
