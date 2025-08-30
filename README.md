# Tasks - VSCode Extension

A minimalist task management extension for Visual Studio Code that helps you organize and track tasks directly within your markdown files using a simple hashtag-based system.

## Overview

Tasks scans your workspace for markdown files containing task markers and due dates, then displays them in an organized, filterable list. Tasks are automatically sorted chronologically and include visual indicators for overdue items.

## Features

- **Automatic Task Detection**: Scans all `.md` files in your workspace
- **Smart Filtering**: Three view modes (All, Due Soon, Overdue)
- **Visual Indicators**: Emoji icons show task status at a glance
- **Relative Date Display**: Shows "Due tomorrow" instead of raw timestamps
- **Task Completion**: Mark tasks as done to hide them from all views
- **Easy Timestamp Insertion**: Right-click to insert properly formatted due dates

## How to Use

### Creating Tasks

To create a task, your markdown file must contain:

1. **Task marker**: `#task` hashtag anywhere in the file
2. **Due date**: A timestamp in the format `[YYYY/MM/DD HH:MM:SS AM/PM]`
3. **File extension**: Must be a `.md` (markdown) file

**Example task file:**
```markdown
# Project Planning

Need to finish the quarterly report #task

## Due Date
[2025/09/15 05:00:00 PM]

## Notes
- Include sales figures
- Review with team lead
```

*Note that the only important thing about the above example markdown file is that it contains `#task` (making the entier file considered to be a definition of a task) and the formatted timestamp which has to be in that specific format.*

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

#### Right-Click Context Menu
- **Location**: Any text editor
- **Option**: "Insert Timestamp"
- **Function**: Inserts current date/time in the required format at cursor position

### Task Display Format

Tasks appear in the panel as:
```
[emoji] filename.md - [relative date]
```

**Examples:**
- `📅 report.md - Due tomorrow`
- `📅 meeting-notes.md - Due in 3 days`
- `⚠️ budget.md - 2 days overdue`
- `📅 project.md - Due today`

### Filtering Options

#### All Tasks
- Shows every task file in the workspace
- Excludes files marked with `#done`
- Sorted chronologically (earliest due date first)

#### Tasks Due Soon
- Shows tasks due within the next 3 days
- **Also includes** all overdue tasks
- Perfect for daily/weekly planning

#### Tasks Overdue
- Shows only tasks past their due date
- Helps identify what needs immediate attention
- Items appear with ⚠️ warning icon

### Task Lifecycle

1. **Create**: Add `#task` and timestamp to a `.md` file
2. **Track**: View in Tasks panel with appropriate filter
3. **Complete**: Add `#done` hashtag to mark as finished
4. **Archive**: Completed tasks automatically disappear from all views

### Timestamp Format

**Required format**: `[YYYY/MM/DD HH:MM:SS AM/PM]`

**Examples:**
- `[2025/12/25 09:30:00 AM]`
- `[2025/01/15 11:45:00 PM]`

**Inserting timestamps:**
1. Place cursor where you want the timestamp
2. Right-click → "Insert Timestamp"
3. Current date/time is automatically inserted in correct format

## Task Prioritization

You can set a priority for each task file using hashtags:

- `#p1` — **High Priority** (red icon)
- `#p2` — **Medium Priority** (orange icon)
- `#p3` — **Low Priority** (blue icon)

If no priority hashtag is present, the file is treated as high priority (`#p1`).

### How Priorities Work
- The Task Panel sorts tasks by priority first (high → medium → low), then by due date.at the top of our Tasks panel we have an icon for "tasks due soon" and it really looks more like a refresh icon than a tasks due soon icon so can we put a different icon on that button. you could still stay with the clock theme on the icon if you want but the circular Arrow makes it look like it's refresh so we need to do a different icon than the one we currently have there.
- Each task shows a colored icon:
  - 🔴 High
  - 🟠 Medium
  - 🔵 Low
- If a task is overdue, a yellow warning icon (⚠️) appears immediately after the priority icon.

**Example:**
```
🔴⚠️ Finish urgent report - 2 days overdue
🟠 Review documentation - Due tomorrow
🔵 Update website - Due in 5 days
```

Just add the appropriate hashtag anywhere in your markdown file to set its priority.

## Installation

### From VSIX File
1. Download the `.vsix` file
2. Open VSCode
3. Go to Extensions view (Ctrl+Shift+X)
4. Click "..." menu → "Install from VSIX..."
5. Select the downloaded file

### Manual Installation
1. Copy extension folder to VSCode extensions directory:
   - **Windows**: `%USERPROFILE%\.vscode\extensions`
   - **macOS**: `~/.vscode/extensions/`
   - **Linux**: `~/.vscode/extensions/`
2. Restart VSCode

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

### Key Dependencies
- `vscode`: VSCode Extension API
- `typescript`: Language support
- `@types/node`: Node.js type definitions

## Troubleshooting

**Tasks not appearing?**
- Ensure file has `.md` extension
- Verify `#task` hashtag is present
- Check timestamp format matches exactly: `[YYYY/MM/DD HH:MM:SS AM/PM]`
- Make sure file doesn't contain `#done`

**Relative dates seem wrong?**
- Extension uses calendar days, not 24-hour periods
- "Due tomorrow" means due on the next calendar day

**Extension not loading?**
- Check VSCode version compatibility
- Try reloading window (Ctrl+Shift+P → "Reload Window")
- Check Developer Console for errors

