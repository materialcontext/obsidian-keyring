import { pathRules } from './paths';

export interface KeyringSettings {
	readonly caseSensitive: boolean;
	readonly hoverDelayMs: number;
	readonly maxNestingDepth: number;
	readonly excludedFolders: readonly string[];
}

export const DEFAULT_SETTINGS: KeyringSettings = {
	caseSensitive: false,
	hoverDelayMs: 300,
	maxNestingDepth: 5,
	excludedFolders: [],
};

export interface IntRange {
	readonly min: number;
	readonly max: number;
}

export const HOVER_DELAY_MS: IntRange = { min: 0, max: 5000 };
export const NESTING_DEPTH: IntRange = { min: 1, max: 20 };

/**
 * Settings from disk, which may be missing, partial, or hand-edited. Each
 * field that isn't valid falls back to its default.
 */
export function sanitizeSettings(raw: unknown): KeyringSettings {
	const saved = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	const { caseSensitive, hoverDelayMs, maxNestingDepth, excludedFolders } = saved;
	return {
		caseSensitive:
			typeof caseSensitive === 'boolean' ? caseSensitive : DEFAULT_SETTINGS.caseSensitive,
		hoverDelayMs: inRange(hoverDelayMs, HOVER_DELAY_MS) ?? DEFAULT_SETTINGS.hoverDelayMs,
		maxNestingDepth:
			inRange(maxNestingDepth, NESTING_DEPTH) ?? DEFAULT_SETTINGS.maxNestingDepth,
		excludedFolders: Array.isArray(excludedFolders)
			? excludedFolders.filter((f): f is string => typeof f === 'string')
			: DEFAULT_SETTINGS.excludedFolders,
	};
}

/** The message to show for a number outside `range`, or `undefined` when it's valid. */
export function rangeError(value: unknown, { min, max }: IntRange): string | undefined {
	return inRange(value, { min, max }) === null
		? `Enter a whole number from ${min} to ${max}.`
		: undefined;
}

/** What each part of the folder list contributes to the rules: blank rows and slashes don't count. */
const effectiveFolders = (folders: readonly string[]): string =>
	pathRules(folders).excludedFolders.join('\n');

/** What has to happen after settings change. Hover delay and depth are read live and need nothing. */
export interface SettingsImpact {
	/** Keys or the set of indexed files changed. */
	readonly reindex: boolean;
	/** Which notes are scanned for marks changed, so open views must redraw. */
	readonly refreshViews: boolean;
}

export function settingsImpact(previous: KeyringSettings, next: KeyringSettings): SettingsImpact {
	const foldersChanged =
		effectiveFolders(previous.excludedFolders) !== effectiveFolders(next.excludedFolders);
	return {
		reindex: foldersChanged || previous.caseSensitive !== next.caseSensitive,
		refreshViews: foldersChanged,
	};
}

function inRange(value: unknown, { min, max }: IntRange): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
		? value
		: null;
}
