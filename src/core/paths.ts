import type { IndexOp } from './termIndex';
import type { SectionRef } from './types';

/** Which vault paths take part: markdown files outside the excluded folders. */
export interface PathRules {
	readonly excludedFolders: readonly string[];
}

/** Trim entries, strip surrounding slashes, and drop blanks. */
export function pathRules(excludedFolders: readonly string[]): PathRules {
	const folders = excludedFolders
		.map((f) => f.trim().replace(/^\/+|\/+$/g, ''))
		.filter((f) => f !== '');
	return { excludedFolders: folders };
}

/** True when `path` is `folder` itself or anything inside it. The empty folder is the vault root. */
export function isUnder(path: string, folder: string): boolean {
	return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

export function isIndexable(path: string, rules: PathRules): boolean {
	return path.endsWith('.md') && !rules.excludedFolders.some((folder) => isUnder(path, folder));
}

/** `path` moved from under `fromFolder` to under `toFolder`. */
export function rebase(path: string, fromFolder: string, toFolder: string): string {
	return toFolder + path.slice(fromFolder.length);
}

/**
 * The op for a file moved from `oldPath` to `newPath`. Moving into an excluded
 * folder (or away from `.md`) removes it, and moving out indexes it afresh
 * from `sectionsAt`, which is only called in that case.
 */
export function opForRename(
	oldPath: string,
	newPath: string,
	rules: PathRules,
	sectionsAt: (path: string) => readonly SectionRef[],
): IndexOp {
	if (!isIndexable(newPath, rules)) return { kind: 'remove', path: oldPath };
	if (isIndexable(oldPath, rules)) return { kind: 'rename', from: oldPath, to: newPath };
	return { kind: 'set', path: newPath, sections: sectionsAt(newPath) };
}
