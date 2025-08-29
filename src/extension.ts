// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Task file container with parsed timestamp for sorting
class TaskFile {
	constructor(
		public readonly filePath: string,
		public readonly fileName: string,
		public readonly fileUri: vscode.Uri,
		public readonly timestamp: Date,
		public readonly timestampString: string
	) {}
}

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
	private taskFileData: TaskFile[] = []; // Store task files with parsed timestamps

	refresh(): void {
		this.scanForTaskFiles().then(() => {
			this._onDidChangeTreeData.fire();
		});
	}

	refreshDueSoon(): void {
		this.scanForTaskFiles(true).then(() => {
			this._onDidChangeTreeData.fire();
		});
	}

	refreshOverdue(): void {
		this.scanForTaskFiles(false, true).then(() => {
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

	private async scanForTaskFiles(dueSoonOnly: boolean = false, overdueOnly: boolean = false): Promise<void> {
		this.taskFiles = [];
		this.taskFileData = [];
		this.scannedFiles.clear(); // Clear the set of scanned files
		
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		await this.scanDirectory(workspaceFolder.uri.fsPath);
		
		// Filter by due soon or overdue if requested
		let filteredTaskData = this.taskFileData;
		const now = new Date();
		
		if (dueSoonOnly) {
			// Filter by due soon (within 3 days OR overdue)
			const threeDaysFromNow = new Date();
			threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
			threeDaysFromNow.setHours(23, 59, 59, 999); // End of the day
			
			filteredTaskData = this.taskFileData.filter(taskFile => 
				taskFile.timestamp <= threeDaysFromNow
			);
		} else if (overdueOnly) {
			// Filter by overdue only (past due date)
			filteredTaskData = this.taskFileData.filter(taskFile => 
				taskFile.timestamp < now
			);
		}
		
		// Sort task files by timestamp (chronological order)
		filteredTaskData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		
		// Create tree items from sorted task files
		this.taskFiles = filteredTaskData.map(taskFile => 
			new TaskFileItem(
				`${taskFile.fileName} (${taskFile.timestampString})`,
				taskFile.fileUri,
				vscode.TreeItemCollapsibleState.None,
				{
					command: 'vscode.open',
					title: 'Open File',
					arguments: [taskFile.fileUri]
				}
			)
		);
		
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
			
			// Check for both #task and timestamp pattern, but exclude #done files
			const hasTaskHashtag = content.includes('#task');
			const isDoneTask = content.includes('#done');
			const timestampRegex = /\[20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9] (AM|PM)\]/;
			const timestampMatch = content.match(timestampRegex);
			
			// Only include files that have #task, have a timestamp, but don't have #done
			if (hasTaskHashtag && timestampMatch && !isDoneTask) {
				const timestampString = timestampMatch[0];
				const parsedTimestamp = this.parseTimestamp(timestampString);
				
				if (parsedTimestamp) {
					const fileName = path.basename(filePath);
					const fileUri = vscode.Uri.file(filePath);
					
					const taskFile = new TaskFile(
						filePath,
						fileName,
						fileUri,
						parsedTimestamp,
						timestampString
					);
					
					this.taskFileData.push(taskFile);
				}
			}
		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error);
		}
	}

	private parseTimestamp(timestampString: string): Date | null {
		try {
			// Remove brackets and parse the timestamp
			const cleanTimestamp = timestampString.replace(/[\[\]]/g, '');
			// Convert to a format Date can parse: MM/DD/YYYY HH:MM:SS AM/PM
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
		} catch (error) {
			console.error(`Error parsing timestamp ${timestampString}:`, error);
			return null;
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

	// Initial scan
	taskProvider.refresh();

	// Add to subscriptions
	context.subscriptions.push(treeView);
	context.subscriptions.push(showAllTasksCommand);
	context.subscriptions.push(showTasksDueSoonCommand);
	context.subscriptions.push(showTasksOverdueCommand);
	context.subscriptions.push(insertTimestampCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
