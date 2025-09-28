# Timex - VSCode Extension

**Use Markdown files as your Calendar/Task Manager, in a time-series Panel**

A minimalist, flexible VSCode panel for managing markdown-based items (tasks, todos, notes, reminders) using lightweight hashtags and timestamps in your files. You can define multiple candidate hashtags (e.g. `#task, #todo, #note`) and switch the **active primary hashtag** live; only files containing the active one are listed. 

![Task Panel Screenshot](task-panel-screenshot.png)

## Quick Start (2‑Minute Tour)

Think of this extension as a lightweight, chronological stream of dated (or undated) markdown “items” — more like a rolling time‑aware list than a traditional calendar grid.

1. Create or open a workspace folder.
2. Click the Activity Bar icon (checklist) to open the panel.
3. Press the + button: a new file (e.g. `task-0001.md`) appears with a timestamp and `#p3`.
4. Type a short description under the prefilled line (or just rename the file — filename can become the label).
5. (Optional) Switch the primary hashtag via the tag icon (e.g. from `#task` to `#note`) to view a different stream.
6. Use the filter (funnel) icon for Due Soon / Overdue / priority slices; search (🔍) narrows further.
7. Add or edit timestamps manually or with +Day/+Week/+Month/+Year commands.
8. Mark something done by adding `#done` anywhere in the file.

You now have a living time series of work: closest due items float to your attention; undated or far‑future items sit quietly at the bottom (sentinel date logic). Switch hashtags to pivot context without noise.

### Minimal Example
```markdown
#task [09/30/2025 05:00:00 PM] #p2
```
Filename: `plan-sprint.md` → Displays as: `🟠 (3) Plan sprint` (if 3 days out)

### Legend
- Priority Icons: 🔴 = P1 / 🟠 = P2 / 🔵 = P3 (absence = P1)
- Days Indicator: `(5)` in 5 days, `(0)` today, `(-2)` overdue by 2, `(?)` no date
- ⚠️ added after icon if overdue
- ✅ indicates `#done`

### When to Use This vs a Calendar
- Need fast capture in plain files, not structured tasks
- Want sorting + proximity awareness without rigid scheduling
- Prefer grep‑able, versionable data over proprietary formats
- Maintain parallel streams (e.g. `#task` for actionable, `#note` for reference, `#idea` for backlog)

Jump to: [Features](#features) · [How to Use](#how-to-use) · [Configuration](#configuration) · [Filtering & Search](#filtering--search)

**Examples:**
- `🔴 (1) Finish quarterly report` - Due tomorrow
- `🟠 (5) Review meeting notes` - Due in 5 days  
- `🔴⚠️ (-2) Update budget` - 2 days overdue
- `🟠 (0) Fix login bug` - Due today
- `🔴 (?) Plan vacation` - No due date specified
- `✅ (-5) Completed presentation` - Completed task (5 days past due date)

An “Item” (task / todo / note / reminder) is just a markdown file containing the currently active primary hashtag (default `#task`). Optionally add a timestamp `[MM/DD/YYYY HH:MM:SS AM/PM]` or `[MM/DD/YYYY]` to give it a due date. The file is then auto‑indexed and displayed.


## Overview (how it works)

The extension scans your workspace for markdown files containing the active primary hashtag, extracts optional due dates, and displays them in a filterable, prioritized list with overdue indicators. Timex assumes that, When it encounters a file containing. The hashtag `#task` for example, that the entire file represents the definition of that task. So this extension should not be used to manage things like TODOs Where you might have multiple `#todo` hashtags in the same file. This is because this extension assumes that each file represents only one single thing to be tracked. In other words, when your project is scanned, and a tag like `#task` is found in a file, that tells the extension the file itself, is a task definition. 

## Features

- **Multi‑Hashtag Support**: Configure a comma list (default `#task, #todo, #note`) and switch active context instantly.
- **Primary Hashtag Selector**: Tag icon opens a picker; selection updates the panel and title bar.
- **Dynamic Title Bar**: Shows current primary hashtag (e.g. `#todo - ALL - P*`).
- **Automatic Item Detection**: Scans `.md` files for active hashtag.
- **Optional Due Dates**: Recognizes `[MM/DD/YYYY HH:MM:SS AM/PM]` or `[MM/DD/YYYY]`.
- **Priority Tags**: `#p1 #p2 #p3` with sensible default to `#p1`.
- **Completion Tag**: `#done` hides items unless included via completion filter.
- **Unified Filtering**: Priority + temporal (All / Due Soon / Overdue) + completion.
- **Integrated Search**: Filename + file content, layered atop current filters.
- **Relative Time Badges**: `(5)`, `(0)`, `(-2)`, `(?)` sentinel for no date.
- **Quick Create**: + button seeds new file with active hashtag + timestamp + `#p3`.
- **Timestamp Tools**: Insert current timestamp; add +Day/+Week/+Month/+Year.

## How to Use

### Creating Items (Tasks / Notes / Todos)

Quick: Click **+** in the panel header. A new file is created using the currently active primary hashtag (e.g. `#todo`) plus a timestamp and `#p3` priority.

Manual: Create a `.md` file that contains the active primary hashtag somewhere inside. Optionally add a timestamp for due date awareness. Priority + completion + other hashtags are additive.

Required minimum for inclusion:
1. `.md` file
2. Contains the active primary hashtag (defaults to `#task` until you switch)

Optional enhancements:
- Timestamp `[MM/DD/YYYY HH:MM:SS AM/PM]` or `[MM/DD/YYYY]`
- Priority `#p1/#p2/#p3`
- Completion state `#done`

**Example item file:**
```markdown
# Project Planning

Need to finish the quarterly report #task #p1

## Due Date
[09/15/2025 05:00:00 PM]

## Notes
- Include sales figures
- Review with team lead
```

Only the presence of the active hashtag matters for indexing. Everything else is optional metadata.

#### Minimal Filename-Driven Items

If the file has only a single non-empty line (starting with `#` or `[`), the filename (sans extension and numeric/underscore prefix) becomes the display label.

Example:
- Filename: `fix-login-bug.md`
- Contents: `#task [09/15/2025 05:00:00 PM]`
- Result: Appears as “Fix login bug”.

Great for ultra-fast capture—just create a descriptively named file with the hashtag.

## Configuration

Settings (File > Preferences > Settings > Extensions > Timex):

| Setting | Default | Description |
|---------|---------|-------------|
| `task-manager.primaryHashtag` | `#task` | Active hashtag scanned for actionable items. Change via the tag toolbar icon or directly here. |
| `task-manager.hashtags` | `#task, #todo, #note` | Comma‑separated candidate hashtags available in the selection picker. Whitespace trimmed; empty entries ignored. |
| `task-manager.newTaskFolder` | (empty) | Optional wildcard path for new item files. If starts with `*`, suffix match is used. |

Behavior Notes:

1. Changing `primaryHashtag` triggers a rescan (only files containing the new hashtag are considered items).
2. The list in `hashtags` does not auto‑switch context; it just feeds the picker.
3. Remove or add custom hashtags (e.g. `#idea`, `#errand`) without restarting—selector reflects changes immediately.
4. If `primaryHashtag` is not present in `hashtags`, it is still honored (useful for temporary experiments).

- **`task-manager.newTaskFolder`**: Specifies the folder where new task files are created when using the + button
  - **Type**: String
  - **Default**: `""` (workspace root)
  - **Example values**: `"tasks"`, `"todo"`, `"projects/tasks"`
  - **Note**: Folder path is relative to workspace root. The folder will be created automatically if it doesn't exist.

Quick Access:
You can also set or change this value without opening Settings via the panel:
- Open the panel, then either:
  - Click the panel title menu (three dots) and select "Folder for New Tasks...", or
  - Right‑click inside the panel (empty space or an item) and choose "Folder for New Tasks...".
This opens an input box and updates the `task-manager.newTaskFolder` setting directly.

To access settings:
1. Open VSCode Settings (File → Preferences → Settings, or Ctrl+Shift+P then type "Preferences: Open Settings")
2. Search for "timex" (or legacy: "task manager")
3. Look for "New Task Folder" under the "Timex" section
4. Configure the folder path as needed

### Supported Hashtags

Core:
- Active Primary (configurable): marks a file as an actionable item (default `#task`, switchable to any candidate like `#todo`, `#note`, `#idea`).
- `#done` – Completed item (hidden unless Completion filter includes it).
- `#p1`, `#p2`, `#p3` – High / Medium / Low priority (absence = treated as `#p1`).

Custom:
- Add your own in `task-manager.hashtags` (e.g. `#meeting, #research`). Switch via tag icon to focus a specific stream without changing underlying files.

Notes:
- Only one primary hashtag is active at a time.
- Items may contain multiple candidate hashtags; only the active one matters for visibility.
- You can maintain parallel “streams” of work (e.g. planning notes vs action tasks) and jump between them instantly.

### GUI Elements

#### Activity Bar Icon
- Left sidebar; opens the panel.

#### Primary Hashtag Selector (Tag Icon)
- Location: Panel title bar (leftmost icon with a tag symbol).
- Action: Opens a QuickPick of configured candidate hashtags (from `task-manager.hashtags`).
- Behavior: Selecting one updates `task-manager.primaryHashtag`, refreshes the list, and rewrites title bar prefix.
- Visual: Currently selected hashtag shows a checkmark; others a hollow circle.

#### Items Panel
- Title: `<primaryHashtag> - <VIEW> - <PRIORITY>` plus search snippet when active.
- Content: Items derived from files containing the primary hashtag.

#### Filter Menu
Funnel icon; unified picker controlling three orthogonal groups (view / priority / completion). Switching any filter clears active search.

#### Search Button
- Magnifying glass icon; layered filter on already in-memory items (case-insensitive). Title shows query until cleared.

**Search Examples:**
- Search for `"bug"` - finds files named `fix-login-bug.md` or files containing the word "bug"
- Search for `"review"` - finds any task with "review" in the filename or content
- Search for `"2025"` - finds tasks with "2025" in their timestamps or content

This feature is perfect for quickly finding specific tasks in large workspaces without having to browse through all tasks manually.

#### New Item Button
- + icon; creates incrementally numbered file (e.g. `task-0001.md`) in configured folder. Prefills with active hashtag + current timestamp + `#p3`.

Fastest capture path—click + and start typing.

**Configuring Task Folder**: You can specify where new task files are created by setting the `task-manager.newTaskFolder` configuration. Go to VSCode settings (File → Preferences → Settings) and search for "timex" to find the "New Task Folder" setting. Enter a folder path relative to your workspace root (e.g., "tasks", "todos", or "project/tasks"). Leave empty to create tasks in the workspace root.

#### Right-Click Context Menu

**In Text Editor:**
- **Location**: Any text editor
- **Option**: "Insert Timestamp"
- **Function**: Inserts current date/time in the required format at cursor position

**In Panel:**
- **Location**: Right-click on any item in the panel
- **Options Available**:
  - **Folder for New Tasks...**: Quickly set or change the folder path used when creating new tasks via the + button (updates the `task-manager.newTaskFolder` setting)
  - **Date Extension Commands**: +Day, +Week, +Month, +Year (for tasks with timestamps)
  - **Delete Task**: Permanently removes the task file from your workspace
  - **About**: Shows extension information

**Delete Task Feature:**
- Right-click any item in the panel and select "Delete Task"
- Shows a confirmation dialog before deletion
- Permanently removes the markdown file from your workspace
- Automatically refreshes the panel after deletion
- **Warning**: This action cannot be undone - the file will be permanently deleted

### Item Display Format

Items appear in the panel with a compact format showing days until due date in parentheses:
```
[emoji] ([days]) [task description]
```

The days indicator shows:
- **Positive numbers**: Days until due date (e.g., `(5)` = due in 5 days)
- **Zero**: Due today (`(0)`)
- **Negative numbers**: Days overdue (e.g., `(-3)` = 3 days overdue)
- **Question mark**: No due date specified (`(?)`)

The item description is either:
- The first non-blank line (leading `#` trimmed), OR
- The filename (without `.md`) if only hashtag + optional timestamp present.

**Examples:**
- `� (1) Finish quarterly report` - Due tomorrow
- `� (5) Review meeting notes` - Due in 5 days  
- `🔴⚠️ (-2) Update budget` - 2 days overdue
- `� (0) Fix login bug` - Due today
- `🔴 (?) Plan vacation` - No due date specified

### Filtering & Search

The panel offers a single unified filtering system plus search to refine what you see. All functionality related to filtering and searching is documented here (nowhere else) for simplicity.

#### Overview
- Open the filter picker via the filter (funnel) icon (one active choice per group; groups combine).
- Open search via the 🔍 icon (search text combines with the currently selected filters until cleared).
- Panel title shows current state (e.g., `Due Soon - P1`, or `SEARCH - P* - 'bug'`).

#### Filter Groups (10 Options Total)
1. (Priority) Any Priority – show every priority level
2. (Priority) Priority 1 (High) – `#p1` or no priority tag
3. (Priority) Priority 2 (Medium) – `#p2`
4. (Priority) Priority 3 (Low) – `#p3`
5. (View) Any Time – no due-date restriction
6. (View) Due Soon – due in next 3 days OR already overdue
7. (View) Overdue – past due date only (⚠️ shown)
8. (Completion) Any Completion – completed + not completed
9. (Completion) Done – contains `#done`
10. (Completion) Not Done – no `#done` (default)

#### Using Filters
1. Click the filter (funnel) icon and pick one option in any group; previous selection in that group is replaced.
2. Combine one selection from each group for precise views (e.g., High + Due Soon + Not Done).
3. Changing filters clears any active search automatically.
4. Overdue tasks always show the warning icon ⚠️; they also appear in Due Soon (by design).

#### Search
| Aspect | Behavior |
|--------|----------|
| Trigger | Click 🔍 icon |
| Scope | Case-insensitive match in filenames and file content |
| Interaction with Filters | Search results are still constrained by active filters |
| Clearing | Run search with empty input OR change any filter |
| Performance | Uses in-memory task data (no full rescan) |

##### Effective Search Use-Cases
- Locate tasks by keyword (client, feature, bug ID)
- Narrow to a sprint window by searching a date fragment (e.g., `2025/09`)
- Combine with Priority 1 to focus critical items containing a term

#### Tips
- If you can’t find a completed task, ensure Completion filter isn’t set to Not Completed.
- To review only recently urgent items: select Due Soon + Priority 1.
- Want everything regardless of status? Use Any Priority + Any Time + Any Completion and clear search.

#### Rationale
Overdue tasks are included in Due Soon so that a single glance covers the immediate action horizon (past-due plus next 72 hours) without toggling views.

### Item Lifecycle

1. **Create**: Add active primary hashtag to a `.md` file (timestamp optional).
2. **Track**: Listed under that hashtag’s context.
3. **Switch Context**: Change primary hashtag to pivot to a different stream (notes vs tasks, etc.).
4. **Complete**: Add `#done` to archive while keeping history.
5. **Review**: Use completion filters to surface archived items.
6. **Iterate**: Bump dates via +Day/+Week/+Month/+Year commands.

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

## Prioritization

Set priority per item using hashtags:

- `#p1` — **High Priority** (red icon)
- `#p2` — **Medium Priority** (orange icon)
- `#p3` — **Low Priority** (blue icon)

If no priority hashtag is present, treated as high priority (`#p1`).

### How Priorities Work
- The panel sorts items by due date (earliest first; undated sentinel last).
- Each item shows a colored icon indicating priority:
  - 🔴 High Priority (`#p1` or no priority tag)
  - 🟠 Medium Priority (`#p2`)
  - 🔵 Low Priority (`#p3`)
- Overdue adds ⚠️ after priority icon.
- Use filter system to isolate priority levels.

**Example:**
```
🔴⚠️ (-2) Finish urgent report
🟠 (1) Review documentation  
🔵 (5) Update website
```

**Priority Filtering**: Use the filter icon:
- **Any Priority**: Shows tasks of all priority levels (default)
- **Priority 1 (High)**: Shows only high-priority tasks
- **Priority 2 (Medium)**: Shows only medium-priority tasks  
- **Priority 3 (Low)**: Shows only low-priority tasks

Add the priority hashtag anywhere inside the file.

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
code --install-extension timex-0.0.2.vsix
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

**Item not appearing?**
- Confirm active primary hashtag (title bar prefix) matches hashtag inside file.
- File must be `.md`.
- Timestamp (if present) must match one of supported formats exactly.
- Completed item? Change completion filter to All / Completed.

**Changed hashtag list but picker not updated?**
- Ensure entries are comma-separated; no stray semicolons.
- Empty tokens are ignored—double commas collapse.

**Relative days feel off?**
- Calculations are calendar-day based (midnight boundaries), not 24h rolling windows.

**Primary hashtag title didn’t update after settings edit?**
- Use the tag icon to re-select, or reload window (command: Reload Window).

**Still stuck?**
- Open Developer Tools (Help → Toggle Developer Tools) and check console for errors.

