import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path'; 

// Constants
export const SCANNING_MESSAGE = 'Scanning workspace';

// Task file container with parsed timestamp for sorting
export class TaskFile {
	constructor(
		public readonly filePath: string,
		public readonly fileName: string,
		public readonly fileUri: vscode.Uri,
		public readonly timestamp: Date,
		public readonly timestampString: string,
		public readonly priority: 'p1' | 'p2' | 'p3'
	) {}
}

// Task file item for the tree view
export class TaskFileItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly resourceUri: vscode.Uri,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		
		// Only set tooltip and description for actual files (not scanning indicator)
		// Check if this is the scanning indicator by looking at the label
		if (this.label.includes(SCANNING_MESSAGE)) {
			// For scanning indicator, just show the label without path info
			this.tooltip = this.label;
			this.description = '';
		} else {
			// For task files, show the full file path in tooltip but clean display name in description
			const fileName = path.basename(resourceUri.fsPath);
			this.tooltip = `${this.label} - ${resourceUri.fsPath}`;
			this.description = ''; // Remove filename display
		}
	}
}

// Tree data provider for task files
export class TaskProvider implements vscode.TreeDataProvider<TaskFileItem> {
	// Extracts the first non-blank line from a file
	private getFileDisplayText(filePath: string): string {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split(/\r?\n/);
			const nonEmptyLines = lines.filter(line => line.trim().length > 0);
			
			// Special case: if there's only one non-empty line and it starts with "#" or "["
			// then use the filename as the display text
			if (nonEmptyLines.length === 1) {
				const line = nonEmptyLines[0].trim();
				if (line.startsWith('#') || line.startsWith('[')) {
					const fileName = path.basename(filePath, '.md'); // Remove .md extension
					// Strip leading numeric digits and underscores (e.g., "0001_My Fun Task" -> "My Fun Task")
					const cleanFileName = fileName.replace(/^[\d_]+/, '');
					return cleanFileName;
				}
			}
			
			const firstNonBlank = nonEmptyLines[0];
			if (!firstNonBlank) {
				return '(blank file)';
			}
			// Trim and remove leading hashes and whitespace, then remove task-related hashtags
			let displayText = firstNonBlank.trim().replace(/^#+\s*/, '');
			// Remove task hashtags (#task, #p1, #p2, #p3, #done) and clean up extra whitespace
			displayText = displayText.replace(/#(task|p[123]|done)\b/g, '').replace(/\s+/g, ' ').trim();
			// Trim to maximum of 50 characters
			displayText = displayText.length > 50 ? displayText.substring(0, 50) + '...' : displayText;
			return displayText;
		} catch {
			return '(unable to read file)';
		}
	}
	private _onDidChangeTreeData: vscode.EventEmitter<TaskFileItem | undefined | null | void> = new vscode.EventEmitter<TaskFileItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private taskFiles: TaskFileItem[] = [];
	private scannedFiles: Set<string> = new Set(); // Track scanned files to prevent duplicates
	private taskFileData: TaskFile[] = []; // Store task files with parsed timestamps
	private currentFilter: string = 'All'; // Track current filter state
	private currentPriorityFilter: string = 'all'; // Track current priority filter
	private treeView: vscode.TreeView<TaskFileItem> | null = null;
	private isScanning: boolean = false; // Track scanning state

	setTreeView(treeView: vscode.TreeView<TaskFileItem>): void {
		this.treeView = treeView;
		this.updateTreeViewTitle(); // Set initial title
	}

	refresh(): void {
		this.currentFilter = 'All';
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	refreshDueSoon(): void {
		this.currentFilter = 'Due Soon';
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles(true).then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	refreshOverdue(): void {
		this.currentFilter = 'Overdue';
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles(false, true).then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	filterByPriority(priorityFilter: string): void {
		this.currentPriorityFilter = priorityFilter;
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	private showScanningIndicator(): void {
		this.isScanning = true;
		this._onDidChangeTreeData.fire();
	}

	private hideScanningIndicator(): void {
		this.isScanning = false;
	}

	private updateTreeViewTitle(): void {
		if (this.treeView) {
			let priorityText = '';
			switch (this.currentPriorityFilter) {
				case 'p1':
					priorityText = ' - P1';
					break;
				case 'p2':
					priorityText = ' - P2';
					break;
				case 'p3':
					priorityText = ' - P3';
					break;
				default:
					priorityText = ' - P*';
					break;
			}
			this.treeView.title = `${this.currentFilter.toUpperCase()}${priorityText}`;
		}
	}

	getTreeItem(element: TaskFileItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TaskFileItem): Thenable<TaskFileItem[]> {
		if (!element) {
			// Return root level items (all task files or scanning indicator)
			if (this.isScanning) {
				return Promise.resolve([
					new TaskFileItem(
						`⏳ ${SCANNING_MESSAGE}...`,
						vscode.Uri.file(''),
						vscode.TreeItemCollapsibleState.None
					)
				]);
			}
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

		// Apply priority filter if not "all"
		if (this.currentPriorityFilter !== 'all') {
			filteredTaskData = filteredTaskData.filter(taskFile => 
				taskFile.priority === this.currentPriorityFilter
			);
		}
		
		// Sort task files by timestamp (chronological order)
		filteredTaskData.sort((a, b) => {
			return a.timestamp.getTime() - b.timestamp.getTime();
		});
		
		// Create tree items from sorted task files
		this.taskFiles = filteredTaskData.map(taskFile => {
			const relativeDate = this.getRelativeDateString(taskFile.timestamp);
			const isOverdue = taskFile.timestamp < now;
			const isFarFuture = this.isFarFuture(taskFile.timestamp);
			// Use colored square emoji for both overdue and not overdue, based on priority
			let icon = '🔴'; // red for p1
			// Use dimmed/hollow icons for far future tasks
			if (isFarFuture) {
				icon = '⚪'; // white for far future
			}
			else if (taskFile.priority === 'p2') {
				icon = '🟠'; // orange for p2
			} else if (taskFile.priority === 'p3') {
				icon = '🔵'; // blue for p3
			}
			
			const displayText = this.getFileDisplayText(taskFile.filePath);
			// For overdue items, show warning icon immediately after priority icon
			let label = isOverdue
				? `${icon}⚠️ ${displayText} - ${relativeDate}`
				: `${icon} ${displayText} - ${relativeDate}`;
			
			const treeItem = new TaskFileItem(
				label,
				taskFile.fileUri,
				vscode.TreeItemCollapsibleState.None,
				{
					command: 'vscode.open',
					title: 'Open File',
					arguments: [taskFile.fileUri]
				}
			);
			
			// Set context value for far future tasks
			if (isFarFuture) {
				treeItem.contextValue = 'farFutureTask';
			}
			
			return treeItem;
		});
		
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
			
			// Check for #task hashtag, but exclude #done files
			const hasTaskHashtag = content.includes('#task');
			const isDoneTask = content.includes('#done');
			
			// Only include files that have #task but don't have #done
			if (hasTaskHashtag && !isDoneTask) {
				// Look for timestamp, but it's optional now
				const timestampRegex = /\[20[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9](?:\s[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\s(AM|PM))?\]/;
				const timestampMatch = content.match(timestampRegex);
				
				let parsedTimestamp: Date;
				let timestampString: string;
				
				if (timestampMatch) {
					// Use existing timestamp if found
					timestampString = timestampMatch[0];
					const parsed = this.parseTimestamp(timestampString);
					parsedTimestamp = parsed || new Date(2050, 0, 1, 12, 0, 0); // Fallback to 2050 if parsing fails
				} else {
					// No timestamp found, use January 1st, 2050 as default (far future)
					parsedTimestamp = new Date(2050, 0, 1, 12, 0, 0); // January 1st, 2050 at noon
					timestampString = `[2050/01/01 12:00:00 PM]`;
				}
				
				// Detect priority
				let priority: 'p1' | 'p2' | 'p3' = 'p1';
				if (content.includes('#p2')) {
					priority = 'p2';
				} else if (content.includes('#p3')) {
					priority = 'p3';
				}
				
				const fileName = path.basename(filePath);
				const fileUri = vscode.Uri.file(filePath);
				const taskFile = new TaskFile(
					filePath,
					fileName,
					fileUri,
					parsedTimestamp,
					timestampString,
					priority
				);
				this.taskFileData.push(taskFile);
			}
		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error);
		}
	}

	private parseTimestamp(timestampString: string): Date | null {
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

	private getRelativeDateString(taskDate: Date): string {
		const now = new Date();
		// Reset time to beginning of day for accurate day comparison
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
		
		const diffMs = taskDay.getTime() - today.getTime();
		const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
		
		if (diffDays < 0) {
			// Overdue
			const overdueDays = Math.abs(diffDays);
			if (overdueDays === 1) {
				return '1 day overdue';
			} else {
				return `${overdueDays} days overdue`;
			}
		} else if (diffDays === 0) {
			// Due today
			return 'Due today';
		} else if (diffDays === 1) {
			// Due tomorrow
			return 'Due tomorrow';
		} else {
			// Due in future
			if (diffDays > 365) {
				return 'Due in over a year';
			} else {
				return `Due in ${diffDays} days`;
			}
		}
	}

	private isFarFuture(taskDate: Date): boolean {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
		
		const diffMs = taskDay.getTime() - today.getTime();
		const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
		
		return diffDays > 365;
	}
}
