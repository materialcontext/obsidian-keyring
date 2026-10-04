import type { Key } from './types';

export interface NormalizeOptions {
	readonly caseSensitive: boolean;
}

/**
 * Two strings match when their keys are equal. Keys drop all whitespace and,
 * unless `caseSensitive`, case-fold. NFC first so composed and decomposed
 * accents compare equal.
 */
export function normalizeKey(text: string, { caseSensitive }: NormalizeOptions): Key {
	const compact = text.normalize('NFC').replace(/\s+/gu, '');
	return (caseSensitive ? compact : compact.toLowerCase()) as Key;
}
