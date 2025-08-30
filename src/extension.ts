// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TaskProvider } from './model';

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

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(showAllTasksCommand);
	context.subscriptions.push(showTasksDueSoonCommand);
	context.subscriptions.push(showTasksOverdueCommand);
	context.subscriptions.push(insertTimestampCommand);
	context.subscriptions.push(filterPriorityCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
