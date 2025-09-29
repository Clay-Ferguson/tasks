import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Finds a folder in the workspace root that matches a wildcard pattern.
 * The wildcard is assumed to be a leading asterisk representing a numeric prefix.
 * @param workspaceRoot The workspace root path
 * @param wildcardPattern The pattern like "*My Tasks"
 * @returns The actual folder name if found, or null if not found
 */
export function findFolderByWildcard(workspaceRoot: string, wildcardPattern: string): string | null {
	if (!wildcardPattern.startsWith('*')) {
		return wildcardPattern; // No wildcard, return as-is
	}

	const suffix = wildcardPattern.substring(1); // Remove the leading asterisk

	try {
		const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory() && entry.name.endsWith(suffix)) {
				return entry.name;
			}
		}
	} catch (error) {
		console.error('Error scanning workspace root for wildcard folder:', error);
	}

	return null; // No matching folder found
}

/**
 * Parses a timestamp string into a Date object.
 * Supports formats: [MM/DD/YYYY] and [MM/DD/YYYY HH:MM:SS AM/PM]
 * @param timestampString The timestamp string to parse
 * @returns Date object or null if parsing failed
 */
export function parseTimestamp(timestampString: string): Date | null {
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

/**
 * Formats a Date object into the extension's timestamp string.
 * @param date Source date to format
 * @param includeTime When true, include HH:MM:SS AM/PM; otherwise output date-only format
 */
export function formatTimestamp(date: Date, includeTime: boolean = true): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	if (!includeTime) {
		return `[${month}/${day}/${year}]`;
	}

	const hours12 = date.getHours() % 12 || 12;
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
	return `[${month}/${day}/${year} ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}]`;
}

/**
 * Reads all configured task hashtags from workspace settings.
 */
export function getAllConfiguredHashtags(): string[] {
	const config = vscode.workspace.getConfiguration('task-manager');
	const hashtagsString = config.get<string>('hashtags', '#task, #todo, #note');
	return hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
}

/**
 * Returns true if the provided content contains any configured hashtag.
 */
export function containsAnyConfiguredHashtag(content: string): boolean {
	const allHashtags = getAllConfiguredHashtags();
	return allHashtags.some(hashtag => content.includes(hashtag));
}

/**
 * Finds all configured hashtags present in the given content.
 */
export function findHashtagsInContent(content: string): Set<string> {
	const configuredHashtags = getAllConfiguredHashtags();
	const foundHashtags = new Set<string>();

	for (const hashtag of configuredHashtags) {
		if (content.includes(hashtag)) {
			foundHashtags.add(hashtag);
		}
	}

	return foundHashtags;
}

/**
 * Determines the emoji icon to display for a task file based on its properties.
 */
export function getIconForTaskFile(taskFile: {
	priority: 'p1' | 'p2' | 'p3' | '';
	isCompleted: boolean;
	tagsInFile: Set<string>;
}): string {
	const isTask = taskFile.tagsInFile.has('#task');

	let icon = '⚪';

	if (taskFile.tagsInFile.has('#note')) {
		icon = '📝';
	}

	if (isTask) {
		if (taskFile.isCompleted) {
			icon = '✅';
		} else if (taskFile.priority === 'p1') {
			icon = '🔴';
		} else if (taskFile.priority === 'p2') {
			icon = '🟠';
		} else if (taskFile.priority === 'p3') {
			icon = '🔵';
		}
	}

	return icon;
}

/**
 * Returns a friendly relative date description for a task due date.
 */
export function getRelativeDateString(taskDate: Date): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

	const diffMs = taskDay.getTime() - today.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < 0) {
		const overdueDays = Math.abs(diffDays);
		return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
	} else if (diffDays === 0) {
		return 'Due today';
	} else if (diffDays === 1) {
		return 'Due tomorrow';
	} else if (diffDays > 365) {
		return 'Due in over a year';
	}

	return `Due in ${diffDays} days`;
}

/**
 * Calculates the number of days between today and the task date.
 * Returns '?' for sentinel far future dates.
 */
export function getDaysDifference(taskDate: Date): number | string {
	if (taskDate.getFullYear() >= 2050) {
		return '?';
	}

	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

	const diffMs = taskDay.getTime() - today.getTime();
	return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determines whether a task date is more than a year in the future.
 */
export function isFarFuture(taskDate: Date): boolean {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

	const diffMs = taskDay.getTime() - today.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	return diffDays > 365;
}
