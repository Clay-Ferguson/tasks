# Task Manager - VSCode Extension

A powerful task management extension for Visual Studio Code that helps you organize and track tasks directly within your markdown files using a simple hashtag-based system.

## Overview

Task Manager scans your workspace for markdown files containing task markers and due dates, then displays them in an organized, filterable list. Tasks are automatically sorted chronologically and include visual indicators for overdue items.

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

### Supported Hashtags

- **`#task`** - Marks a file as containing a task (required)
- **`#done`** - Marks a task as completed (hides from all views)

### GUI Elements

#### Activity Bar Icon
- **Location**: Left sidebar activity bar
- **Icon**: Checklist symbol
- **Function**: Opens the Task Manager panel

#### Task Panel
- **Location**: Left sidebar (when Task Manager is active)
- **Title**: Shows current filter ("All", "Due Soon", or "Overdue")
- **Content**: List of tasks with relative due dates and status icons

#### Filter Buttons
Located in the Task Manager panel header:
- **Show All Tasks**: Displays all active tasks
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
2. **Track**: View in Task Manager panel with appropriate filter
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

### Project Structure
```
task-extension/
├── src/
│   └── extension.ts          # Main extension logic
├── package.json              # Extension manifest & dependencies
├── tsconfig.json            # TypeScript configuration
├── .vscode/                 # VSCode settings
├── .vscodeignore           # Files to exclude from package
└── README.md               # This file
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

## License

MIT License - Feel free to modify and distribute.

## Version History

- **0.0.1**: Initial release with complete task management functionalityr README

This is the README for your extension "task-manager". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
