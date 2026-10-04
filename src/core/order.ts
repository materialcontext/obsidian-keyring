import type { SectionRef } from './types';

type Positioned = Pick<SectionRef, 'path' | 'bodyStart'>;

/** Entries from `currentPath` first, then by path (locale order), then by position in the file. */
export function orderEntries<T extends Positioned>(
	entries: readonly T[],
	currentPath: string,
): T[] {
	return [...entries].sort(
		(a, b) =>
			rank(a, currentPath) - rank(b, currentPath) ||
			a.path.localeCompare(b.path) ||
			a.bodyStart - b.bodyStart,
	);
}

const rank = (entry: Positioned, currentPath: string): number =>
	entry.path === currentPath ? 0 : 1;
