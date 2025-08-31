# Copilot Instructions for AI Agents

## Project Overview
This is a VSCode extension for minimalist task management using markdown files. Tasks are detected by scanning `.md` files for the `#task` hashtag and a timestamp in `[YYYY/MM/DD HH:MM:SS AM/PM]` or `[YYYY/MM/DD]` format. The extension displays tasks in a panel, sorted and filtered by due date, priority, and completion status.

## Key Architectural Concepts
- **Task Model:** Each task is a markdown file with `#task` and a timestamp. The filename may serve as the description for simple tasks.
- **Detection Logic:** Only `.md` files with the correct hashtag and timestamp are considered tasks. Files with `#done` are hidden from all views.
- **Priority:** Tasks can be prioritized using `#p1`, `#p2`, or `#p3` hashtags. Default is high priority if none is present.
- **Panel UI:** The extension provides filterable views (All, Due Soon, Overdue) and visual status indicators (emoji, color, warning icons).
- **Timestamp Handling:** Full timestamps and date-only formats are supported. Date-only defaults to noon.

## Developer Workflows
- **Build:**
  - `npm install`
  - `npm run compile`
- **Test/Debug:**
  - Press F5 in VSCode for Extension Development Host
  - Or run: `code --extensionDevelopmentPath=. .`
- **Package:**
  - Install CLI: `npm install -g @vscode/vsce`
  - Build: `vsce package`
  - Install: `code --install-extension task-manager-0.0.1.vsix`
- **Quick Install:**
  - Run `install.sh` to automate build, package, and install steps

## Project-Specific Patterns
- **Minimal Task Files:** Filename is used as description if file contains only a task marker/timestamp.
- **Hashtag Conventions:**
  - `#task` (required)
  - `#done` (completed)
  - `#p1`, `#p2`, `#p3` (priority)
- **Panel Sorting:** Priority first, then due date. Overdue tasks show warning icon.
- **Timestamp Insertion:** Use right-click context menu or manually edit for date-only.

## Integration Points
- **VSCode API:** Extension uses VSCode API for UI, file scanning, and context menus.
- **TypeScript:** All source code is in `src/` and uses TypeScript.
- **Dependencies:** See `package.json` for required packages.

## Key Files
- `src/extension.ts`: Main extension entry point
- `src/model.ts`, `src/models.ts`: Task data models and logic
- `install.sh`: Automated build/install script
- `README.md`: User and developer documentation

## Example Task File
```markdown
#task [2025/09/15 05:00:00 PM]
```

## Troubleshooting
- Tasks must be in `.md` files with correct hashtag and timestamp
- Completed tasks (`#done`) are hidden
- Use provided scripts for build/package/install

---
**Edit this file to add new conventions or update instructions as the project evolves.**
