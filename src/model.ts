import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path'; 
import { title } from 'process';

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
		public readonly priority: 'p1' | 'p2' | 'p3',
		public readonly isCompleted: boolean = false
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
	/**
	 * Creates a markdown tooltip for a task item
	 * @param label The task label with icons and formatting
	 * @param timestampString The raw timestamp string from the file
	 * @returns A MarkdownString tooltip
	 */
	private createTaskTooltip(label: string, timestampString: string): vscode.MarkdownString {
		const timestampLine = timestampString.replace(/[\[\]]/g, '');
		const cleaned = label.replace(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}]|\S)+\s*(⚠️)?\s*\([^)]*\)\s*/u, '').trim();
		
		// Parse the timestamp to get the day of the week
		// parseTimestamp handles both [MM/DD/YYYY] and [MM/DD/YYYY HH:MM:SS AM/PM] formats
		const parsedDate = this.parseTimestamp(timestampString);
		let dayOfWeek = '';
		
		if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() < 2050) {
			const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			dayOfWeek = days[parsedDate.getDay()];
		}
		
		const md = new vscode.MarkdownString();
		md.supportHtml = false;
		md.isTrusted = false;
		
		// Include both timestamp and day of week in the same code block
		// If no day available, show just the timestamp
		const codeContent = dayOfWeek ? `${timestampLine} -- ${dayOfWeek}` : timestampLine;
		md.appendMarkdown(`*\n**${cleaned}**\n\n\`${codeContent}\``);
		
		return md;
	}

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
			// Get primary hashtag without the # symbol for the regex
			const primaryHashtagWithoutHash = this.getPrimaryHashtag().substring(1);
			// Remove task hashtags (primary hashtag, #p1, #p2, #p3, #done) and clean up extra whitespace
			const taskHashtagPattern = new RegExp(`#(${primaryHashtagWithoutHash}|p[123]|done)\\b`, 'g');
			displayText = displayText.replace(taskHashtagPattern, '').replace(/\s+/g, ' ').trim();
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
	private currentSearchQuery: string = ''; // Track current search query
	private completionFilter: 'all' | 'completed' | 'not-completed' = 'not-completed'; // Track completion filter
	private treeView: vscode.TreeView<TaskFileItem> | null = null;
	private isScanning: boolean = false; // Track scanning state
	private cachedPrimaryHashtag: string | null = null; // Cache for primary hashtag

	/**
	 * Gets the current primary hashtag from VSCode workspace configuration
	 * @returns The primary hashtag string (e.g., "#task")
	 */
	getPrimaryHashtag(): string {
		if (this.cachedPrimaryHashtag === null) {
			const config = vscode.workspace.getConfiguration('task-manager');
			this.cachedPrimaryHashtag = config.get<string>('primaryHashtag', '#task');
		}
		return this.cachedPrimaryHashtag;
	}

	/**
	 * Gets all configured hashtags from VSCode workspace configuration
	 * @returns Array of hashtag strings (e.g., ["#task", "#todo", "#note"])
	 */
	private getAllConfiguredHashtags(): string[] {
		const config = vscode.workspace.getConfiguration('task-manager');
		const hashtagsString = config.get<string>('hashtags', '#task, #todo, #note');
		return hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
	}

	/**
	 * Checks if content contains any of the configured hashtags
	 * @param content The file content to check
	 * @returns true if content contains any configured hashtag
	 */
	containsAnyConfiguredHashtag(content: string): boolean {
		const allHashtags = this.getAllConfiguredHashtags();
		return allHashtags.some(hashtag => content.includes(hashtag));
	}

	/**
	 * Clears the cached primary hashtag to force reload from configuration
	 * Call this when the configuration changes
	 */
	clearPrimaryHashtagCache(): void {
		this.cachedPrimaryHashtag = null;
	}

	setTreeView(treeView: vscode.TreeView<TaskFileItem>): void {
		this.treeView = treeView;
		this.updateTreeViewTitle(); // Set initial title
	}

	// Getter methods for current filter states
	getCurrentPriorityFilter(): string {
		return this.currentPriorityFilter;
	}

	getCurrentViewFilter(): string {
		return this.currentFilter;
	}

	getCompletionFilter(): 'all' | 'completed' | 'not-completed' {
		return this.completionFilter;
	}

	/**
	 * Updates a single task item after its timestamp has been modified
	 * This is more efficient than a full refresh for single item updates
	 * @param filePath The absolute path of the file that was updated
	 * @param newTimestampString The new timestamp string in the file
	 */
	async updateSingleTask(filePath: string, newTimestampString: string): Promise<void> {
		try {
			// Find the task in our data
			const taskIndex = this.taskFileData.findIndex(task => task.filePath === filePath);
			if (taskIndex === -1) {
				// Task not found, fall back to full refresh
				this.refresh();
				return;
			}

			// Parse the new timestamp
			const newTimestamp = this.parseTimestamp(newTimestampString);
			if (!newTimestamp) {
				// Failed to parse, fall back to full refresh
				this.refresh();
				return;
			}

			// Re-read the file to get updated priority and content
			const content = fs.readFileSync(filePath, 'utf8');
			let priority: 'p1' | 'p2' | 'p3' = 'p1';
			if (content.includes('#p2')) {
				priority = 'p2';
			} else if (content.includes('#p3')) {
				priority = 'p3';
			}

			// Update the task data
			const oldTask = this.taskFileData[taskIndex];
			const isCompleted = content.includes('#done');
			const updatedTask = new TaskFile(
				oldTask.filePath,
				oldTask.fileName,
				oldTask.fileUri,
				newTimestamp,
				newTimestampString,
				priority,
				isCompleted
			);
			this.taskFileData[taskIndex] = updatedTask;

			// Re-build the task files display (similar to scanForTaskFiles but without scanning)
			await this.rebuildTaskDisplay();
			
			// Fire the tree data change event
			this._onDidChangeTreeData.fire();

			// Highlight the updated item
			await this.highlightUpdatedTask(filePath);

		} catch (error) {
			console.error('Error updating single task:', error);
			// Fall back to full refresh on error
			this.refresh();
		}
	}

	/**
	 * Highlights and selects the specified task item in the tree view
	 * @param filePath The absolute path of the file to highlight
	 */
	private async highlightUpdatedTask(filePath: string): Promise<void> {
		if (!this.treeView) {
			return;
		}

		try {
			const updatedTreeItem = this.taskFiles.find(item => 
				item.resourceUri.fsPath === filePath
			);
			
			if (updatedTreeItem) {
				// Reveal and select the updated item
				await this.treeView.reveal(updatedTreeItem, { 
					select: true, 
					focus: false, 
					expand: false 
				});
			}
		} catch (error) {
			console.error('Error highlighting updated task:', error);
			// Don't throw - this is just a UX enhancement
		}
	}

	/**
	 * Rebuilds the task display from existing taskFileData without scanning
	 * This is used by updateSingleTask to avoid a full workspace scan
	 */
	private async rebuildTaskDisplay(): Promise<void> {
		// Apply the same filtering logic as scanForTaskFiles
		let filteredTaskData = this.taskFileData;
		const now = new Date();
		
		if (this.currentFilter === 'Due Soon') {
			// Filter by due soon (within 3 days OR overdue)
			const threeDaysFromNow = new Date();
			threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
			threeDaysFromNow.setHours(23, 59, 59, 999); // End of the day
			
			filteredTaskData = this.taskFileData.filter(taskFile => 
				taskFile.timestamp <= threeDaysFromNow
			);
		} else if (this.currentFilter === 'Overdue') {
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
		
		// Create tree items from sorted task files (same logic as scanForTaskFiles)
		this.taskFiles = filteredTaskData.map(taskFile => {
			const daysDiff = this.getDaysDifference(taskFile.timestamp);
			const isOverdue = taskFile.timestamp < now;
			const isFarFuture = this.isFarFuture(taskFile.timestamp);
			// Use colored square emoji for both overdue and not overdue, based on priority
			let icon = '🔴'; // red for p1
			
			// Use checkmark for completed tasks
			if (taskFile.isCompleted) {
				icon = '✅'; // checkmark for completed tasks
			}
			// Use dimmed/hollow icons for far future tasks
			else if (isFarFuture) {
				icon = '⚪'; // white for far future
			}
			else if (taskFile.priority === 'p2') {
				icon = '🟠'; // orange for p2
			} else if (taskFile.priority === 'p3') {
				icon = '🔵'; // blue for p3
			}
			
			const displayText = this.getFileDisplayText(taskFile.filePath);
			// Show days difference in parentheses at the beginning of the task description
			// For overdue items, show warning icon immediately after priority icon
			let label = isOverdue
				? `${icon}⚠️ (${daysDiff}) ${displayText}`
				: `${icon} (${daysDiff}) ${displayText}`;
			
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

			// Create markdown tooltip
			treeItem.tooltip = this.createTaskTooltip(label, taskFile.timestampString);
			
			// Set context value based on timestamp presence and far future status
			// Check if task has a real timestamp (not the default 2050 one)
			const hasRealTimestamp = taskFile.timestamp.getFullYear() < 2050;
			
			if (isFarFuture && !hasRealTimestamp) {
				treeItem.contextValue = 'farFutureTask';
			} else if (hasRealTimestamp) {
				treeItem.contextValue = 'taskWithTimestamp';
			} else {
				treeItem.contextValue = 'taskWithoutTimestamp';
			}
			
			return treeItem;
		});
		
		// Update context to show/hide the tree view
		vscode.commands.executeCommand('setContext', 'workspaceHasTaskFiles', this.taskFiles.length > 0);
	}

	refresh(): void {
		this.currentFilter = 'All';
		this.currentSearchQuery = ''; // Clear search when refreshing
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	refreshDueSoon(): void {
		this.currentFilter = 'Due Soon';
		this.currentSearchQuery = ''; // Clear search when switching filters
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles(true).then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	refreshOverdue(): void {
		this.currentFilter = 'Overdue';
		this.currentSearchQuery = ''; // Clear search when switching filters
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles(false, true).then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	filterByPriority(priorityFilter: string): void {
		this.currentPriorityFilter = priorityFilter;
		this.currentSearchQuery = ''; // Clear search when changing priority filter
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	setCompletionFilter(filter: 'all' | 'completed' | 'not-completed'): void {
		this.completionFilter = filter;
		this.currentSearchQuery = ''; // Clear search when changing completed filter
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.scanForTaskFiles().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	searchTasks(query: string): void {
		this.currentSearchQuery = query.toLowerCase();
		this.currentFilter = 'Search';
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.applyFiltersToExistingData().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	clearSearch(): void {
		this.currentSearchQuery = '';
		if (this.currentFilter === 'Search') {
			this.currentFilter = 'All';
		}
		this.updateTreeViewTitle();
		this.showScanningIndicator();
		this.applyFiltersToExistingData().then(() => {
			this.hideScanningIndicator();
			this._onDidChangeTreeData.fire();
		});
	}

	clearFilters(): void {
		// Reset all filters to their default "all" states
		this.currentPriorityFilter = 'all';
		this.currentFilter = 'All';
		this.completionFilter = 'all';
		this.currentSearchQuery = '';
		
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
			const titleParts: string[] = [];
			
			// 1. Tag selection: Always show the primary hashtag (this is the base filter)
			const primaryHashtag = this.getPrimaryHashtag();
			const hashtagDisplay = primaryHashtag === 'all-tags' ? '' : primaryHashtag;
			if (hashtagDisplay) {
				titleParts.push(hashtagDisplay);
			}
			
			// 2. Priority: Only show if not 'all' (the default/no-filtering state)
			if (this.currentPriorityFilter !== 'all') {
				const priorityDisplay = this.currentPriorityFilter.toUpperCase();
				titleParts.push(priorityDisplay);
			}

			// 3. Time range: Only show if not 'All' (the default/no-filtering state)
			if (this.currentFilter !== 'All') {
				titleParts.push(this.currentFilter.toUpperCase());
			}
			
			// 4. Completion status: Only show if not 'not-completed' (the default state)			
			let completionDisplay = '';
			if (this.completionFilter === 'all') {
				// leave blank
			} else if (this.completionFilter === 'completed') {
				completionDisplay = 'DONE';
			}
			else {
				completionDisplay = 'NOT DONE';
			}
			if (completionDisplay) {
				titleParts.push(completionDisplay);
			}
			
			
			// 5. Search query: Only show if there's an active search
			if (this.currentSearchQuery) {
				titleParts.push(`"${this.currentSearchQuery}"`);
			}
			
			// Join all parts with ' - ' separator, filter out any empty strings just to be safe
			const filteredParts = titleParts.filter(part => part.trim().length > 0);
			if (filteredParts.length > 0) {
				this.treeView.title = filteredParts.join(' - ');
			}
			else {
				this.treeView.title = '';
			}
			console.log(`Updated tree view title [${this.treeView.title}]`);
		}
	}

	/**
	 * Applies current filters to existing taskFileData without rescanning
	 * Used for search and other operations that don't need a full workspace scan
	 */
	private async applyFiltersToExistingData(): Promise<void> {
		// Apply date/time filters first
		let filteredTaskData = this.taskFileData;
		const now = new Date();
		
		if (this.currentFilter === 'Due Soon') {
			const threeDaysFromNow = new Date();
			threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
			threeDaysFromNow.setHours(23, 59, 59, 999);
			
			filteredTaskData = this.taskFileData.filter(taskFile => 
				taskFile.timestamp <= threeDaysFromNow
			);
		} else if (this.currentFilter === 'Overdue') {
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
		
		// Apply search filter if there's a search query
		if (this.currentSearchQuery) {
			filteredTaskData = await this.filterTasksBySearch(filteredTaskData, this.currentSearchQuery);
		}
		
		// Sort task files by timestamp (chronological order)
		filteredTaskData.sort((a, b) => {
			return a.timestamp.getTime() - b.timestamp.getTime();
		});
		
		// Create tree items from filtered task files
		this.taskFiles = filteredTaskData.map(taskFile => {
			const daysDiff = this.getDaysDifference(taskFile.timestamp);
			const isOverdue = taskFile.timestamp < now;
			const isFarFuture = this.isFarFuture(taskFile.timestamp);
			
			// Use colored square emoji for both overdue and not overdue, based on priority
			let icon = '🔴'; // red for p1
			
			// Use checkmark for completed tasks
			if (taskFile.isCompleted) {
				icon = '✅'; // checkmark for completed tasks
			}
			// Use dimmed/hollow icons for far future tasks
			else if (isFarFuture) {
				icon = '⚪'; // white for far future
			}
			else if (taskFile.priority === 'p2') {
				icon = '🟠'; // orange for p2
			} else if (taskFile.priority === 'p3') {
				icon = '🔵'; // blue for p3
			}
			
			const displayText = this.getFileDisplayText(taskFile.filePath);
			// Show days difference in parentheses at the beginning of the task description
			// For overdue items, show warning icon immediately after priority icon
			let label = isOverdue
				? `${icon}⚠️ (${daysDiff}) ${displayText}`
				: `${icon} (${daysDiff}) ${displayText}`;
			
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

			// Create markdown tooltip
			treeItem.tooltip = this.createTaskTooltip(label, taskFile.timestampString);
			
			// Set context value based on timestamp presence and far future status
			// Check if task has a real timestamp (not the default 2050 one)
			const hasRealTimestamp = taskFile.timestamp.getFullYear() < 2050;
			
			if (isFarFuture && !hasRealTimestamp) {
				treeItem.contextValue = 'farFutureTask';
			} else if (hasRealTimestamp) {
				treeItem.contextValue = 'taskWithTimestamp';
			} else {
				treeItem.contextValue = 'taskWithoutTimestamp';
			}
			
			return treeItem;
		});
		
		// Update context to show/hide the tree view
		vscode.commands.executeCommand('setContext', 'workspaceHasTaskFiles', this.taskFiles.length > 0);
	}

	/**
	 * Filters task files by search query, checking both filename and file content
	 */
	private async filterTasksBySearch(taskFiles: TaskFile[], searchQuery: string): Promise<TaskFile[]> {
		const results: TaskFile[] = [];
		
		for (const taskFile of taskFiles) {
			try {
				// Check if filename contains search query
				const fileNameMatch = taskFile.fileName.toLowerCase().includes(searchQuery);
				
				// Check if file content contains search query
				const content = await fs.promises.readFile(taskFile.filePath, 'utf8');
				const contentMatch = content.toLowerCase().includes(searchQuery);
				
				if (fileNameMatch || contentMatch) {
					results.push(taskFile);
				}
			} catch (error) {
				console.error(`Error reading file during search: ${taskFile.filePath}`, error);
				// If we can't read the file, include it if filename matches
				if (taskFile.fileName.toLowerCase().includes(searchQuery)) {
					results.push(taskFile);
				}
			}
		}
		
		return results;
	}

	getTreeItem(element: TaskFileItem): vscode.TreeItem {
		return element;
	}

	getParent(element: TaskFileItem): vscode.ProviderResult<TaskFileItem> {
		// Since our tree is flat (no hierarchy), all items have no parent
		return null;
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
			const daysDiff = this.getDaysDifference(taskFile.timestamp);
			const isOverdue = taskFile.timestamp < now;
			const isFarFuture = this.isFarFuture(taskFile.timestamp);
			// Use colored square emoji for both overdue and not overdue, based on priority
			let icon = '🔴'; // red for p1
			
			// Use checkmark for completed tasks
			if (taskFile.isCompleted) {
				icon = '✅'; // checkmark for completed tasks
			}
			// Use dimmed/hollow icons for far future tasks
			else if (isFarFuture) {
				icon = '⚪'; // white for far future
			}
			else if (taskFile.priority === 'p2') {
				icon = '🟠'; // orange for p2
			} else if (taskFile.priority === 'p3') {
				icon = '🔵'; // blue for p3
			}
			
			const displayText = this.getFileDisplayText(taskFile.filePath);
			// Show days difference in parentheses at the beginning of the task description
			// For overdue items, show warning icon immediately after priority icon
			let label = isOverdue
				? `${icon}⚠️ (${daysDiff}) ${displayText}`
				: `${icon} (${daysDiff}) ${displayText}`;
			
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

			// Create markdown tooltip
			treeItem.tooltip = this.createTaskTooltip(label, taskFile.timestampString);
			
			// Set context value based on timestamp presence and far future status
			// Check if task has a real timestamp (not the default 2050 one)
			const hasRealTimestamp = taskFile.timestamp.getFullYear() < 2050;
			
			if (isFarFuture && !hasRealTimestamp) {
				treeItem.contextValue = 'farFutureTask';
			} else if (hasRealTimestamp) {
				treeItem.contextValue = 'taskWithTimestamp';
			} else {
				treeItem.contextValue = 'taskWithoutTimestamp';
			}
			
			return treeItem;
		});
		
		// Update context to show/hide the tree view
		vscode.commands.executeCommand('setContext', 'workspaceHasTaskFiles', this.taskFiles.length > 0);
	}

	// todo-0: look for ways to speed this scan up. Is there a way to only grab .md files up front?
	private async scanDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				
				// Skip node_modules, .git, and other common directories we don't want to scan
				if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
					await this.scanDirectory(fullPath);
				} else if (entry.isFile() && this.isTaskFile(entry.name)) {
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

	private isTaskFile(fileName: string): boolean {
		const lowerFileName = fileName.toLowerCase();
		// Ignore files starting with underscore or period
		if (fileName.startsWith('_') || fileName.startsWith('.')) {
			return false;
		}
		return lowerFileName.endsWith('.md');
	}

	private async scanFile(filePath: string): Promise<void> {
		try {
			// Prevent duplicate scanning of the same file
			if (this.scannedFiles.has(filePath)) {
				return;
			}
			this.scannedFiles.add(filePath);

		const content = await fs.promises.readFile(filePath, 'utf8');

		// Check for primary hashtag or any hashtag if in 'all-tags' mode
		const primaryHashtag = this.getPrimaryHashtag();
		const hasTaskHashtag = primaryHashtag === 'all-tags' 
			? this.containsAnyConfiguredHashtag(content)
			: content.includes(primaryHashtag);
		const isDoneTask = content.includes('#done');			// Include files based on completion filter
			let includeTask = false;
			if (hasTaskHashtag) {
				if (this.completionFilter === 'all') {
					includeTask = true;
				} else if (this.completionFilter === 'completed') {
					includeTask = isDoneTask;
				} else if (this.completionFilter === 'not-completed') {
					includeTask = !isDoneTask;
				}
			}
			
			if (includeTask) {
				// Look for timestamp, but it's optional now
				// Only support the new standard format: [MM/DD/YYYY] or [MM/DD/YYYY HH:MM:SS AM/PM]
				const timestampRegex = /\[[0-9]{2}\/[0-9]{2}\/20[0-9]{2}(?:\s[0-9]{2}:[0-9]{2}:[0-9]{2}\s(?:AM|PM))?\]/;
				const timestampMatch = content.match(timestampRegex);
				
				let parsedTimestamp: Date;
				let timestampString: string;
				
				if (timestampMatch) {
					// Use existing timestamp if found (keep original string for display)
					timestampString = timestampMatch[0];
					const parsed = this.parseTimestamp(timestampString);
					parsedTimestamp = parsed || new Date(2050, 0, 1, 12, 0, 0);
				} else {
					// No timestamp found, use January 1st, 2050 as default (far future)
					parsedTimestamp = new Date(2050, 0, 1, 12, 0, 0);
					// Emit placeholder in new standard format
					timestampString = `[01/01/2050 12:00:00 PM]`;
				}
				
				// Detect priority
				let priority: 'p1' | 'p2' | 'p3' = 'p1';
				if (content.includes('#p2')) {
					priority = 'p2';
				} else if (content.includes('#p3')) {
					priority = 'p3';
				}
				
				// Check if task is completed
				const isCompleted = isDoneTask;
				
				const fileName = path.basename(filePath);
				const fileUri = vscode.Uri.file(filePath);
				const taskFile = new TaskFile(
					filePath,
					fileName,
					fileUri,
					parsedTimestamp,
					timestampString,
					priority,
					isCompleted
				);
				this.taskFileData.push(taskFile);
			}
		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error);
		}
	}

	private parseTimestamp(timestampString: string): Date | null {
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

	private getDaysDifference(taskDate: Date): number | string {
		// Check if this is a task without a real timestamp (defaulted to 2050)
		if (taskDate.getFullYear() >= 2050) {
			return '?';
		}
		
		const now = new Date();
		// Reset time to beginning of day for accurate day comparison
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
		
		const diffMs = taskDay.getTime() - today.getTime();
		const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
		
		return diffDays;
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
