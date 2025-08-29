// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Task file item for the tree view
class TaskFileItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly resourceUri: vscode.Uri,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.tooltip = `${this.label} - ${resourceUri.fsPath}`;
		this.description = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', resourceUri.fsPath);
	}
}

// Tree data provider for task files
class TaskProvider implements vscode.TreeDataProvider<TaskFileItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TaskFileItem | undefined | null | void> = new vscode.EventEmitter<TaskFileItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private taskFiles: TaskFileItem[] = [];
	private scannedFiles: Set<string> = new Set(); // Track scanned files to prevent duplicates

	refresh(): void {
		this.scanForTaskFiles().then(() => {
			this._onDidChangeTreeData.fire();
		});
	}

	getTreeItem(element: TaskFileItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TaskFileItem): Thenable<TaskFileItem[]> {
		if (!element) {
			// Return root level items (all task files)
			return Promise.resolve(this.taskFiles);
		}
		return Promise.resolve([]);
	}

	private async scanForTaskFiles(): Promise<void> {
		this.taskFiles = [];
		this.scannedFiles.clear(); // Clear the set of scanned files
		
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		await this.scanDirectory(workspaceFolder.uri.fsPath);
		
		// Update context to show/hide the tree view
		vscode.commands.executeCommand('setContext', 'workspaceHasTaskFiles', this.taskFiles.length > 0);
	}

	private async scanDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				
				// Skip node_modules, .git, and other common directories we don't want to scan
				if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
					await this.scanDirectory(fullPath);
				} else if (entry.isFile() && this.isMarkdownFile(entry.name)) {
					await this.scanFile(fullPath);
				}
			}
		} catch (error) {
			console.error(`Error scanning directory ${dirPath}:`, error);
		}
	}

	private shouldSkipDirectory(dirName: string): boolean {
		const skipDirs = ['node_modules', '.git', '.vscode', 'out', 'dist', 'build', '.next', 'target'];
		return skipDirs.includes(dirName) || dirName.startsWith('.');
	}

	private isMarkdownFile(fileName: string): boolean {
		return fileName.toLowerCase().endsWith('.md');
	}

	private async scanFile(filePath: string): Promise<void> {
		try {
			// Prevent duplicate scanning of the same file
			if (this.scannedFiles.has(filePath)) {
				return;
			}
			this.scannedFiles.add(filePath);

			const content = await fs.promises.readFile(filePath, 'utf8');
			
			// Check for both #task and timestamp pattern
			const hasTaskHashtag = content.includes('#task');
			const timestampRegex = /\[20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\]/;
			const hasTimestamp = timestampRegex.test(content);
			
			if (hasTaskHashtag && hasTimestamp) {
				const fileName = path.basename(filePath);
				const fileUri = vscode.Uri.file(filePath);
				
				const taskItem = new TaskFileItem(
					fileName,
					fileUri,
					vscode.TreeItemCollapsibleState.None,
					{
						command: 'vscode.open',
						title: 'Open File',
						arguments: [fileUri]
					}
				);
				
				this.taskFiles.push(taskItem);
			}
		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error);
		}
	}
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Task Manager extension is now active!');

	// Create the tree data provider
	const taskProvider = new TaskProvider();
	
	// Register the tree view
	const treeView = vscode.window.createTreeView('taskExplorer', {
		treeDataProvider: taskProvider,
		showCollapseAll: true
	});

	// Register commands
	const showAllTasksCommand = vscode.commands.registerCommand('task-manager.showAllTasks', () => {
		taskProvider.refresh();
		vscode.window.showInformationMessage('Scanning for files containing #task...');
	});

	const refreshTasksCommand = vscode.commands.registerCommand('task-manager.refreshTasks', () => {
		taskProvider.refresh();
	});

	// Initial scan
	taskProvider.refresh();

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(showAllTasksCommand);
	context.subscriptions.push(refreshTasksCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
