# AI Agent Guide: Tasks VS Code Extension

Concise, project-specific knowledge to modify this extension safely and productively.

## Core Purpose
Lightweight task manager: scans workspace *.md files for `#task` and optional timestamp, renders a filtered tree with priority, due-date proximity, completion state, and search support.

## Architecture Snapshot
- Entry: `src/extension.ts` wires commands, tree view (`taskExplorer`), file watcher, and timestamp adjustment helpers.
- Data/State: `TaskProvider` in `src/model.ts` holds in‑memory arrays (`taskFileData`, `taskFiles`) + filter state (`currentFilter`, `currentPriorityFilter`, `completionFilter`, `currentSearchQuery`).
- Model Classes: `TaskFile` (raw metadata) and `TaskFileItem` (TreeItem presentation). No persistence outside markdown files.
- Update Strategy: Bulk rescans (`scanForTaskFiles`) vs targeted single‑item optimization (`updateSingleTask`) when a timestamp changes.
- Sentinels: Missing timestamp -> synthetic far‑future date `01/01/2050 12:00:00 PM` (used to compute `?` days + “far future” styling/ filtering logic).

## Task Parsing Rules
- File qualifies only if it contains `#task` and passes completion filter logic.
- Timestamp optional; regex supports `[MM/DD/YYYY]` or `[MM/DD/YYYY HH:MM:SS AM/PM]` (year must start with `20`).
- Priority hashtag mapping: default = `p1` unless `#p2` / `#p3` present. `#done` marks completion.
- Display text: first non-blank line cleaned; if only one non-blank line starting with `#` or `[` then filename (minus numeric/underscore prefix & `.md`) becomes label.

## Filtering & Search Mechanics
- View filters: All | Due Soon (<= 3 days OR overdue) | Overdue (strict past due). Overdue also appears in Due Soon by design.
- Priority filter: all | p1 | p2 | p3 (affects listing & tree title suffix `P* / P1 / P2 / P3`).
- Completion filter: not-completed (default) | completed | all (affects inclusion during scan).
- Search: filename + file content, case-insensitive, applied over current in‑memory set (no workspace rescan). Clears automatically when changing any filter.
- Tree title formatting: `${FILTER.toUpperCase()} - P? - "query"` logic in `updateTreeViewTitle()`.

## Performance Considerations
- Avoid full rescans when only a single timestamp changes: prefer `updateSingleTask` (it re-parses just the file and rebuilds display state).
- File watcher delays 100ms to avoid partial writes.
- Far future ( >365 days ) tasks flagged for dim icon; sentinel (2050) always treated as far future.

## Commands & UI (Sources in `extension.ts`)
- Filter Picker: `task-manager.filterPriority` builds QuickPick with 3 grouped sections (priority/view/completion) using codicons for check vs circle outline.
- Search: `task-manager.searchTasks` sets `currentFilter = 'Search'` and uses `applyFiltersToExistingData`.
- New Task: creates incremented `task-0001.md` etc., inserts two blank lines then `#task [timestamp] #p3`.
- Date bumpers: `addDay|addWeek|addMonth|addYear` mutate existing timestamp preserving original format length (date-only vs full).
- Deletion: `task-manager.deleteTask` unlinks file + refresh.

## Editing & Testing Workflow
- Build: `npm install && npm run compile` (outputs to `out/`).
- Debug: F5 launches Extension Dev Host; do NOT create mock `.md` files inside this repo for behavioral tests—open an external folder (author workflow expectation).
- Packaging: `vsce package` then install produced `.vsix`.

## Implementation Patterns To Preserve
- Timestamp parsing kept lenient only for specified formats—avoid expanding without updating regex in multiple places (`model.ts`, watcher in `extension.ts`).
- Always clear `currentSearchQuery` when changing a primary filter (mirrors existing UX).
- Maintain sentinel date logic if introducing new derived fields; many display branches treat `>=2050` as “no real date”.
- Filtering order: date subset -> priority -> (optional) search -> sort -> map to TreeItems.

## When Extending
- Add new filter groups: update QuickPick builder + extend `TaskProvider` state + adjust `updateTreeViewTitle` formatting.
- Adding metadata per task: parse during `scanFile`, extend `TaskFile`, ensure `updateSingleTask` mirrors logic.
- Large-scale changes: prefer incremental rebuild functions like `rebuildTaskDisplay` rather than full rescan if possible.

## Gotchas
- Don’t forget to call `this.hideScanningIndicator()` after async filter/search operations.
- File duplication guarded by `scannedFiles` Set—clear it on each full scan.
- Wildcard new-task folder patterns (`*Suffix`) resolved via `findFolderByWildcard` (only leading `*`).

## Example Minimal Task (filename used as label)
`my-feature.md` contents: `#task [09/30/2025 05:00:00 PM] #p2` ⇒ label derived from filename “my-feature”.

---
Keep this file lean; update only with verified conventions found in code. If uncertain, ask for clarification before codifying a rule.
