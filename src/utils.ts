import * as fs from 'fs';
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
