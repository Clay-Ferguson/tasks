import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const DEFAULT_INCLUDE_GLOBS = ['**/*.md'] as const;

export const DEFAULT_EXCLUDE_GLOBS = [
	'**/node_modules/**',
	'**/.git/**',
	'**/.vscode/**',
	'**/out/**',
	'**/dist/**',
	'**/build/**',
	'**/.next/**',
	'**/target/**'
] as const;

function normalizeGlobList(globs: readonly string[]): string[] {
	return globs
		.map(glob => glob.trim())
		.filter(glob => glob.length > 0);
}

function buildGlobPattern(normalizedGlobs: string[], fallback: string | undefined, wrapSingleInBraces: boolean): string | undefined {
	if (normalizedGlobs.length === 0) {
		return fallback;
	}

	if (normalizedGlobs.length === 1) {
		return wrapSingleInBraces
			? `{${normalizedGlobs[0]}}`
			: normalizedGlobs[0];
	}

	return `{${normalizedGlobs.join(',')}}`;
}

export function getIncludeGlobPattern(): string {
	const config = vscode.workspace.getConfiguration('timex');
	const configuredIncludeGlobs = config.get<string[]>('includeGlobs', Array.from(DEFAULT_INCLUDE_GLOBS));
	const normalizedIncludeGlobs = normalizeGlobList(configuredIncludeGlobs);
	return buildGlobPattern(normalizedIncludeGlobs, DEFAULT_INCLUDE_GLOBS[0], false)!;
}

export function getExcludeGlobPattern(): string | undefined {
	const config = vscode.workspace.getConfiguration('timex');
	const configuredExcludeGlobs = config.get<string[]>('excludeGlobs', Array.from(DEFAULT_EXCLUDE_GLOBS));
	const normalizedExcludeGlobs = normalizeGlobList(configuredExcludeGlobs);
	return buildGlobPattern(normalizedExcludeGlobs, undefined, true);
}

/**
 * DEPRECATED: Finds a folder in the workspace root that matches a wildcard pattern.
 * This function is no longer used since newTaskFolder now supports absolute paths.
 * The wildcard is assumed to be a leading asterisk representing a numeric prefix.
 * @param workspaceRoot The workspace root path
 * @param wildcardPattern The pattern like "*My Tasks"
 * @returns The actual folder name if found, or null if not found
 */
/* Commented out - no longer used with absolute path support
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
*/

/**
 * Reads all configured task hashtags from workspace settings.
 */
export function getAllConfiguredHashtags(): string[] {
	const config = vscode.workspace.getConfiguration('timex');
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
 * Interface representing a numbered file or folder
 */
interface NumberedItem {
	originalName: string;
	nameWithoutPrefix: string;
	isDirectory: boolean;
	fullPath: string;
}

/**
 * Regular expression to match files/folders that start with digits followed by underscore
 */
const NUMBERED_ITEM_REGEX = /^(\d+)_(.*)$/;

/**
 * Scans the workspace root for files and folders that have numeric prefixes followed by underscore
 * @param workspaceRoot The workspace root directory path
 * @returns Array of NumberedItem objects sorted by current numeric order (preserves existing sequence)
 */
export function scanForNumberedItems(workspaceRoot: string): NumberedItem[] {
	try {
		const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
		const numberedItems: NumberedItem[] = [];

		for (const entry of entries) {
			// Skip hidden files/folders (starting with . or _)
			if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
				continue;
			}

			const match = entry.name.match(NUMBERED_ITEM_REGEX);
			if (match) {
				const nameWithoutPrefix = match[2];
				numberedItems.push({
					originalName: entry.name,
					nameWithoutPrefix,
					isDirectory: entry.isDirectory(),
					fullPath: path.join(workspaceRoot, entry.name)
				});
			}
		}

		// Sort by current numeric prefix to preserve existing order, not alphabetically
		numberedItems.sort((a, b) => {
			const aPrefix = parseInt(a.originalName.match(/^(\d+)_/)![1]);
			const bPrefix = parseInt(b.originalName.match(/^(\d+)_/)![1]);
			return aPrefix - bPrefix;
		});

		return numberedItems;
	} catch (error) {
		console.error('Error scanning for numbered items:', error);
		throw new Error(`Failed to scan workspace root: ${error}`);
	}
}

/**
 * Generates a new 5-digit numeric prefix with underscore
 * @param ordinal The ordinal number (10, 20, 30, etc.)
 * @returns Formatted prefix like "00010_"
 */
export function generateNumberPrefix(ordinal: number): string {
	return String(ordinal).padStart(5, '0') + '_';
}

/**
 * Verifies that all file names (after the ordinal prefix) are unique
 * @param numberedItems Array of NumberedItem objects to check
 * @returns Error message if duplicates found, null if all unique
 */
export function verifyNamesAreUnique(numberedItems: NumberedItem[]): string | null {
	const namesSeen = new Map<string, string[]>(); // nameWithoutPrefix -> list of original full names
	
	for (const item of numberedItems) {
		const nameKey = item.nameWithoutPrefix.toLowerCase(); // Case-insensitive comparison
		
		if (!namesSeen.has(nameKey)) {
			namesSeen.set(nameKey, []);
		}
		namesSeen.get(nameKey)!.push(item.originalName);
	}
	
	// Find any duplicates
	const duplicates: string[] = [];
	for (const [nameKey, originalNames] of namesSeen.entries()) {
		if (originalNames.length > 1) {
			duplicates.push(`"${nameKey}" found in: ${originalNames.join(', ')}`);
		}
	}
	
	if (duplicates.length > 0) {
		return `Duplicate file names detected (ignoring ordinal prefixes):\n${duplicates.join('\n')}\n\nPlease rename these files to have unique names before renumbering.`;
	}
	
	return null;
}

/**
 * Renames files and folders with new sequential numbering starting at 00010 and incrementing by 10
 * @param numberedItems Array of NumberedItem objects to rename
 * @returns Promise that resolves when all renames are complete
 */
export async function renumberItems(numberedItems: NumberedItem[]): Promise<void> {
	const renameOperations: Array<{ oldPath: string; newPath: string; oldName: string; newName: string }> = [];

	// First pass: prepare all rename operations, skipping files that don't need renaming
	for (let i = 0; i < numberedItems.length; i++) {
		const item = numberedItems[i];
		const newOrdinal = (i + 1) * 10; // Start at 10, increment by 10
		const newPrefix = generateNumberPrefix(newOrdinal);
		const newName = newPrefix + item.nameWithoutPrefix;

		// Skip if the file already has the correct name
		if (item.originalName === newName) {
			console.log(`Skipping ${item.originalName} (already has correct name)`);
			continue;
		}

		const newPath = path.join(path.dirname(item.fullPath), newName);

		renameOperations.push({
			oldPath: item.fullPath,
			newPath,
			oldName: item.originalName,
			newName
		});
	}

	// If no renames needed, inform the user
	if (renameOperations.length === 0) {
		console.log('All files already have correct numbering - no renames needed');
		return;
	}

	// Second pass: perform the renames
	const errors: Array<{ operation: any; error: any }> = [];
	
	for (const operation of renameOperations) {
		try {
			await fs.promises.rename(operation.oldPath, operation.newPath);
			console.log(`Renamed: ${operation.oldName} → ${operation.newName}`);
		} catch (error) {
			console.error(`Failed to rename ${operation.oldName}:`, error);
			errors.push({ operation, error });
		}
	}

	if (errors.length > 0) {
		const errorMessages = errors.map(e => `${e.operation.oldName}: ${e.error.message}`).join('\n');
		throw new Error(`Failed to rename ${errors.length} items:\n${errorMessages}`);
	}
}
