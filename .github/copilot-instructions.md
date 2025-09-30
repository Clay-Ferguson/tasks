# AI Agent Guide: Timex VS Code Extension

Essential knowledge for AI coding agents to be immediately productive in this markdown-based task management extension.

## Core Purpose
Lightweight VS Code extension that transforms markdown files into a chronological task manager. Scans workspace for `.md` files containing configurable hashtags (default `#task`), extracts timestamps and priorities, displays them in a filterable tree view with due-date proximity indicators.

## Architecture Overview

### Entry Point (`src/extension.ts`)
- **Commands Registration**: 15+ commands from timestamp insertion to task deletion
- **File Watcher**: Real-time `.md` file monitoring with 100ms debounce
- **Tree View Setup**: Wires `TaskProvider` to VS Code's tree view API
- **Timestamp Manipulation**: `addTimeToTask()` preserves original format (date-only vs full datetime)

### Data Layer (`src/model.ts`)
- **TaskProvider**: Main data provider implementing `vscode.TreeDataProvider<TaskFileItem>`
- **TaskFile**: Raw parsed data (filePath, timestamp, priority, completion status)  
- **TaskFileItem**: VS Code TreeItem with display formatting and tooltips
- **State Management**: In-memory arrays (`taskFileData`, `taskFiles`) + filter state
- **Performance Strategy**: `updateSingleTask()` for targeted updates vs full `scanForTaskFiles()`

### Configuration (`package.json`)
Three workspace settings:
- `timex.primaryHashtag`: Active hashtag for filtering (default `#task`)
- `timex.hashtags`: Available hashtags for picker (default `#task, #todo, #note`) 
- `timex.newTaskFolder`: Target folder for new tasks (supports `*wildcard` patterns)

## Task File Format Rules

### Recognition Logic
```markdown
# Any markdown file containing active primary hashtag is a "task"
# Files starting with `_` or `.` are ignored
# Directories: node_modules, .git, .vscode, out, dist, build, .next, target are skipped

#task [09/30/2025 02:00:00 PM] #p2  # ← This line makes it a task
Additional content can be anything...
```

### Timestamp Parsing
**Supported formats only:**
- `[MM/DD/YYYY]` → assumes 12:00 PM same day
- `[MM/DD/YYYY HH:MM:SS AM/PM]` → exact time
- **Regex**: `/\[[0-9]{2}\/[0-9]{2}\/20[0-9]{2}(?:\s[0-9]{2}:[0-9]{2}:[0-9]{2}\s(?:AM|PM))?\]/`
- Missing timestamp → sentinel date `01/01/2050 12:00:00 PM` (displays as `(?)`)

### Priority & Status
- **Priority**: `#p1` (red 🔴), `#p2` (orange 🟠), `#p3` (blue 🔵). No tag = `#p1`
- **Completion**: `#done` anywhere in file marks completed (✅ icon)
- **Far Future**: >365 days shows white circle ⚪ (includes sentinel dates)

### Display Label Logic
```typescript
// If file has only hashtags/timestamps, use clean filename as label
if (nonEmptyLines.length === 1 && (line.startsWith('#') || line.startsWith('['))) {
    return fileName.replace(/^[\d_]+/, ''); // Strip "0001_" prefixes
}
// Otherwise use first non-blank line, cleaned of hashtags
```

## Key Workflow Patterns

### File Watching & Updates
```typescript
// Real-time updates via file watcher (extension.ts:setupFileWatcher)
watcher.onDidChange(async (uri) => {
    // 100ms delay for file write completion
    await new Promise(resolve => setTimeout(resolve, 100));
    // Smart update: single task vs full refresh
    await taskProvider.updateSingleTask(filePath, timestampMatch[0]);
});
```

### Filter State Management
- **Filter combinations**: View (All|Due Soon|Overdue) × Priority (all|p1|p2|p3) × Completion (all|completed|not-completed)
- **Search overlay**: Filename + content matching, case-insensitive, preserves other filters
- **State clearing**: Any filter change clears `currentSearchQuery`
- **Title sync**: `updateTreeViewTitle()` reflects all active filters

### Performance Optimization
```typescript
// Prefer targeted updates when possible
updateSingleTask(filePath, newTimestamp) // Updates one task efficiently  
vs
refresh() // Full workspace rescan

// In-memory filtering for search
applyFiltersToExistingData() // Uses cached taskFileData
vs  
scanForTaskFiles() // Filesystem scan + parse
```

## Development Workflow

### Build & Test
```bash
npm install           # Install dependencies
npm run compile       # TypeScript → out/
npm run watch         # Auto-rebuild on changes (background task available)
```

### Debug Setup
- **F5**: Launch Extension Development Host (clean VS Code instance)
- **Test Strategy**: Open external workspace folder with `.md` files (don't create test files in this repo)
- **Extension logs**: Help → Toggle Developer Tools → Console

### Packaging & Distribution
```bash
npm install -g @vscode/vsce
vsce package                    # Creates .vsix file
code --install-extension timex-0.0.2.vsix
```

## Critical Implementation Details

### Timestamp Manipulation (`addTimeToTask`)
Preserves original format when extending dates:
```typescript
// Detects original format and maintains it
const isLongFormat = cleanTimestamp.includes(' ') && cleanTimestamp.includes(':');
// Long: [MM/DD/YYYY HH:MM:SS AM/PM] 
// Short: [MM/DD/YYYY]
```

### Hashtag Switching
Primary hashtag changes trigger:
1. `clearPrimaryHashtagCache()` - Invalidates cached config
2. `refresh()` - Full rescan with new hashtag filter
3. `updateTreeViewTitle()` - UI title update

### Wildcard Folder Resolution
```typescript
// Supports patterns like "*Tasks" → finds "001_My Tasks", "ProjectTasks", etc.
findFolderByWildcard(workspaceRoot, "*Tasks")
// Only leading asterisk supported
```

### Sentinel Date Logic
Year 2050+ indicates "no real timestamp":
- Displays as `(?)` in day count
- Always sorts to bottom
- Gets far-future icon treatment
- Used for files without `[MM/DD/YYYY...]` patterns

## Extension Points for New Features

### Adding New Filters
1. Extend `TaskProvider` filter state properties
2. Update `filterPriority` command QuickPick options  
3. Modify `updateTreeViewTitle()` format logic
4. Implement filter logic in `scanForTaskFiles()` and `applyFiltersToExistingData()`

### New Task Metadata
1. Parse during `scanFile()` → extend `TaskFile` class
2. Mirror parsing in `updateSingleTask()` 
3. Update display logic in tree item creation
4. Consider impact on sorting and filtering

### Performance Improvements
Prefer `rebuildTaskDisplay()` pattern over full rescans for operations that only change display/filtering of existing data.

## Common Pitfalls

1. **Regex Updates**: Timestamp parsing regex appears in multiple files—update all locations
2. **Filter State**: Always clear search query when changing other filters (UX consistency)
3. **File Watcher**: Don't forget `hideScanningIndicator()` after async operations
4. **Duplicate Prevention**: `scannedFiles` Set prevents duplicate processing—clear on full scans
5. **Context Values**: TreeItem `contextValue` controls right-click menu availability (timestamp vs no-timestamp)

## Example Task Files

**Minimal (filename-derived label):**
```markdown
#task [09/30/2025 05:00:00 PM] #p2
```

**Full content:**
```markdown
# Fix Login Bug

The login form is not validating email addresses properly.

#task [09/12/2025 02:00:00 PM] #p1

## Steps to reproduce
- Enter invalid email format  
- Click login button
- Page hangs indefinitely
```