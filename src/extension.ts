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

		// Create task content
		const taskContent = `#task ${timestamp} #p3`;

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

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(showAllTasksCommand);
	context.subscriptions.push(showTasksDueSoonCommand);
	context.subscriptions.push(showTasksOverdueCommand);
	context.subscriptions.push(insertTimestampCommand);
	context.subscriptions.push(filterPriorityCommand);
	context.subscriptions.push(newTaskCommand);
	context.subscriptions.push(aboutCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
