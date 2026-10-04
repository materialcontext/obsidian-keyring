import type { SectionRef } from './types';

type Positioned = Pick<SectionRef, 'path' | 'bodyStart'>;

/** The order the index keeps each key's sections in: by path (locale order), then by position. */
export function compareSections(a: Positioned, b: Positioned): number {
	return a.path.localeCompare(b.path) || a.bodyStart - b.bodyStart;
}

export function sortSections<T extends Positioned>(entries: readonly T[]): T[] {
	return [...entries].sort(compareSections);
}

/**
 * Entries from `currentPath` first, then the rest, each group keeping its
 * order. `entries` must already be sorted by `compareSections`, as `lookup`
 * returns them, so a hover costs one linear pass instead of a sort
 * (docs/PERFORMANCE.md, P4).
 */
export function orderEntries<T extends Positioned>(
	entries: readonly T[],
	currentPath: string,
): readonly T[] {
	const own: T[] = [];
	const rest: T[] = [];
	for (const entry of entries) (entry.path === currentPath ? own : rest).push(entry);
	return own.length === 0 ? entries : own.concat(rest);
}
