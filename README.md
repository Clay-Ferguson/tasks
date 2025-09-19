# Tasks - VSCode Extension

A minimalist task management extension for VSCode that helps you organize and track tasks directly within your markdown files using a simple hashtag-based system. A `Task` is simply some action that needs to be done in the future and optionally has a due-date and priority. Each task consists of just a markdown file. Any markdown file that contains the hashtag `#task` is automatically considered as a `Task` by this extension, and will show up in the Extension's Tasks Panel. You can optionally include a timestamp formatted like `[MM/DD/YYYY HH:MM:SS AM/PM]` (or `[MM/DD/YYYY]`) to specify a due date. 

![Task Panel Screenshot](task-panel-screenshot.png)

## Overview (how it works)

Tasks scans your workspace for markdown files containing task markers and due dates, then displays them in an organized, filterable list. Tasks are automatically sorted chronologically by due date and include visual indicators for overdue items.

## Features

- **Automatic Task Detection**: Scans all `.md` files in your workspace
- **Smart Filtering**: Three view modes (All, Due Soon, Overdue)
- **Task Search**: Find tasks by searching both filenames and file content
- **Visual Indicators**: Emoji icons show task status at a glance
- **Relative Date Display**: Shows "Due tomorrow" instead of raw timestamps
- **Task Completion**: Mark tasks as done to hide them from all views
- **Easy Timestamp Insertion**: Right-click to insert properly formatted due dates

## How to Use

### Creating Tasks

**Quick Method**: Click the **+** button in the Tasks panel header to instantly create a new task file that's ready to edit.

**Manual Method**: To create a task manually, your markdown file must contain:

1. **Task marker**: `#task` hashtag anywhere in the file
2. **Due date** (optional): A timestamp in the format `[MM/DD/YYYY HH:MM:SS AM/PM]`
3. **File extension**: Must be a `.md` (markdown) file

If no timestamp is provided, the task will be treated as a low-priority, far-future task.

**Example task file:**
```markdown
# Project Planning

Need to finish the quarterly report #task

## Due Date
[09/15/2025 05:00:00 PM]

## Notes
- Include sales figures
- Review with team lead
```

*Note that the only important thing about the above example markdown file is that it contains `#task` (making the entire file considered to be a definition of a task). The formatted timestamp is optional but allows you to specify a due date in the specific format shown.*

#### Simple Task Files Using Filename as Description

For a cleaner workflow, you can create minimal task files where **the filename itself becomes the task description**. This works when your markdown file contains only one non-empty line that starts with either `#` or `[`.

**Example:**
- **Filename**: `Fix-login-bug.md`
- **File contents**: `#task [09/15/2025 05:00:00 PM]` (or just `#task`)
- **Result**: Task appears as "Fix login bug" in the panel

This is perfect for simple tasks where you don't need additional notes or content - just create a descriptively named file with the task marker and timestamp, and the filename (without the .md extension) will be used as the task description.

### Configuration

The extension supports the following configuration options (accessible via VSCode Settings):

- **`task-manager.newTaskFolder`**: Specifies the folder where new task files are created when using the + button
  - **Type**: String
  - **Default**: `""` (workspace root)
  - **Example values**: `"tasks"`, `"todo"`, `"projects/tasks"`
  - **Note**: Folder path is relative to workspace root. The folder will be created automatically if it doesn't exist.

To access settings:
1. Open VSCode Settings (File → Preferences → Settings, or Ctrl+Shift+P then type "Preferences: Open Settings")
2. Search for "task manager" (not just "tasks" to avoid VSCode's built-in task settings)
3. Look for "New Task Folder" under the "Task Manager" section
4. Configure the folder path as needed

### Supported Hashtags

- **`#task`** - Marks a file as containing a task (required)
- **`#done`** - Marks a task as completed (hides from all views)

### GUI Elements

#### Activity Bar Icon
- **Location**: Left sidebar activity bar
- **Icon**: Checklist symbol
- **Function**: Opens the Tasks panel

#### Task Panel
- **Location**: Left sidebar (when Tasks is active)
- **Title**: Shows current filter ("All", "Due Soon", or "Overdue")
- **Content**: List of tasks with relative due dates and status icons

#### Filter Buttons
Located in the Tasks panel header:
- **All Tasks**: Displays all active tasks
- **Tasks Due Soon**: Shows tasks due within 3 days + overdue tasks
- **Tasks Overdue**: Shows only past-due tasks

#### Search Button
- **Location**: Tasks panel header (🔍 magnifying glass icon)
- **Function**: Search through task filenames and content
- **Usage**: 
  - Click the search icon to open the search input dialog
  - Enter any text to search for (searches are case-insensitive)
  - Results show all tasks whose **filenames** or **file content** contain the search text
  - To clear search results, click the search icon again and submit an empty search
  - The panel title shows your search query (e.g., "SEARCH - P* - 'bug'")
  - Any other filter action (All, Due Soon, Overdue, Priority) automatically clears the search

**Search Examples:**
- Search for `"bug"` - finds files named `fix-login-bug.md` or files containing the word "bug"
- Search for `"review"` - finds any task with "review" in the filename or content
- Search for `"2025"` - finds tasks with "2025" in their timestamps or content

This feature is perfect for quickly finding specific tasks in large workspaces without having to browse through all tasks manually.

#### New Task Button
- **Location**: Tasks panel header (+ icon)
- **Function**: Creates a new task file with one click
- **Behavior**: 
  - Generates a new file named `task-001.md`, `task-002.md`, etc. (auto-increments)
  - Places file in the configured task folder (or workspace root if not configured)
  - Pre-fills with `#task [current timestamp] #p3` format
  - Automatically opens the new file for editing
  - Refreshes the Tasks panel to show the new task

This is the quickest way to create a new task - just click the + button and start typing your task description!

**Configuring Task Folder**: You can specify where new task files are created by setting the `task-manager.newTaskFolder` configuration. Go to VSCode settings (File → Preferences → Settings) and search for "task manager" to find the "New Task Folder" setting. Enter a folder path relative to your workspace root (e.g., "tasks", "todos", or "project/tasks"). Leave empty to create tasks in the workspace root.

#### Right-Click Context Menu

**In Text Editor:**
- **Location**: Any text editor
- **Option**: "Insert Timestamp"
- **Function**: Inserts current date/time in the required format at cursor position

**In Tasks Panel:**
- **Location**: Right-click on any task in the Tasks panel
- **Options Available**:
  - **Date Extension Commands**: +Day, +Week, +Month, +Year (for tasks with timestamps)
  - **Delete Task**: Permanently removes the task file from your workspace
  - **About**: Shows extension information

**Delete Task Feature:**
- Right-click any task in the Tasks panel and select "Delete Task"
- Shows a confirmation dialog before deletion
- Permanently removes the markdown file from your workspace
- Automatically refreshes the Tasks panel after deletion
- **Warning**: This action cannot be undone - the file will be permanently deleted

### Task Display Format

Tasks appear in the panel with a compact format showing days until due date in parentheses:
```
[emoji] ([days]) [task description]
```

The days indicator shows:
- **Positive numbers**: Days until due date (e.g., `(5)` = due in 5 days)
- **Zero**: Due today (`(0)`)
- **Negative numbers**: Days overdue (e.g., `(-3)` = 3 days overdue)
- **Question mark**: No due date specified (`(?)`)

The task description is either:
- The first non-blank line from the file (with leading # symbols removed), OR
- The filename (without .md extension) if the file contains only a task marker and/or timestamp

**Examples:**
- `� (1) Finish quarterly report` - Due tomorrow
- `� (5) Review meeting notes` - Due in 5 days  
- `🔴⚠️ (-2) Update budget` - 2 days overdue
- `� (0) Fix login bug` - Due today
- `🔴 (?) Plan vacation` - No due date specified

### Filtering Options

#### All Tasks
- Shows every task file in the workspace
- Excludes files marked with `#done`
- Sorted chronologically by due date (earliest first)

#### Tasks Due Soon
- Shows tasks due within the next 3 days
- **Also includes** all overdue tasks
- Perfect for daily/weekly planning

#### Tasks Overdue
- Shows only tasks past their due date
- Helps identify what needs immediate attention
- Items appear with ⚠️ warning icon

#### Search Tasks
- **Access**: Click the 🔍 search icon in the Tasks panel header
- **Function**: Find specific tasks by searching filenames and content
- **Search scope**: 
  - Task **filenames** (case-insensitive)
  - Task **file content** (case-insensitive)
- **Results**: Shows all matching tasks regardless of due date
- **Clear search**: Submit an empty search query or use any other filter
- **Visual feedback**: Panel title shows your search query

**Search is particularly useful for:**
- Finding tasks by keywords (e.g., "meeting", "bug", "review")
- Locating tasks by project names or client names
- Filtering by specific dates or time periods
- Quick access to tasks in large workspaces

**Note**: Search works with your existing task data - it doesn't trigger a new workspace scan, making it very fast even in large projects.

### Task Lifecycle

1. **Create**: Add `#task` and timestamp to a `.md` file
2. **Track**: View in Tasks panel with appropriate filter
3. **Complete**: Add `#done` hashtag to mark as finished
4. **Archive**: Completed tasks automatically disappear from all views

### Timestamp Format

**Supported formats**:

1. **Full timestamp**: `[MM/DD/YYYY HH:MM:SS AM/PM]` - for time-specific tasks
2. **Date-only**: `[MM/DD/YYYY]` - for day-specific tasks (assumes 12:00 PM)

**Full timestamp example:**
- `[12/25/2025 09:30:00 AM]`

**Date-only examples:**
- `[09/17/2025]` - Due at noon on September 17th

**Inserting timestamps:**
1. Place cursor where you want the timestamp
2. Right-click → "Insert Timestamp"
3. Current date/time is automatically inserted in full format

*Note: The "Insert Timestamp" command always creates full timestamps. For date-only timestamps, you can manually edit to remove the time portion.*

## Task Prioritization

You can set a priority for each task file using hashtags:

- `#p1` — **High Priority** (red icon)
- `#p2` — **Medium Priority** (orange icon)
- `#p3` — **Low Priority** (blue icon)

If no priority hashtag is present, the file is treated as high priority (`#p1`).

### How Priorities Work
- The Task Panel sorts tasks chronologically by due date (earliest first).
- Each task shows a colored icon:
  - 🔴 High
  - 🟠 Medium
  - 🔵 Low
- If a task is overdue, a yellow warning icon (⚠️) appears immediately after the priority icon.

**Example:**
```
🔴⚠️ (-2) Finish urgent report
🟠 (1) Review documentation  
🔵 (5) Update website
```

Just add the appropriate hashtag anywhere in your markdown file to set its priority.

## Developer Information

### Prerequisites
- Node.js (v14 or higher)
- npm
- VSCode (for testing)

### Compilation
```bash
npm install
npm run compile
```

### Development Testing
```bash
# Press F5 in VSCode to launch Extension Development Host
# Or run:
code --extensionDevelopmentPath=. .
```

### Building Distribution Package

1. **Install vsce** (VSCode Extension CLI):
```bash
npm install -g @vscode/vsce
```

2. **Package extension**:
```bash
vsce package
```

This creates a `.vsix` file ready for distribution.

3. **Install packaged extension**:
```bash
code --install-extension task-manager-0.0.1.vsix
```

### Quick Installation Script

For convenience, you can use the provided `install.sh` script which automates the entire build and installation process:

```bash
chmod +x install.sh
./install.sh
```

This script will:
1. Install npm dependencies
2. Compile the TypeScript code
3. Package the extension
4. Install it in VS Code

The script includes error handling and will stop with a descriptive message if any step fails.

### Key Dependencies
- `vscode`: VSCode Extension API
- `typescript`: Language support
- `@types/node`: Node.js type definitions

## Troubleshooting

**Tasks not appearing?**
- Ensure file has `.md` extension
- Verify `#task` hashtag is present
- If using a timestamp, check format matches exactly: `[MM/DD/YYYY HH:MM:SS AM/PM]`
- Make sure file doesn't contain `#done`

**Relative dates seem wrong?**
- Extension uses calendar days, not 24-hour periods
- "Due tomorrow" means due on the next calendar day

**Extension not loading?**
- Check VSCode version compatibility
- Try reloading window (Ctrl+Shift+P → "Reload Window")
- Check Developer Console for errors

