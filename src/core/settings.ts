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

/** A whole number typed into a settings field, or `null` if it isn't one within `range`. */
export function parseBoundedInt(text: string, range: IntRange): number | null {
	const trimmed = text.trim();
	return /^\d+$/.test(trimmed) ? inRange(Number(trimmed), range) : null;
}

/** One folder per line; blank lines and repeats dropped. */
export function parseFolderList(text: string): string[] {
	return [...new Set(text.split('\n').map((line) => line.trim()))].filter((line) => line !== '');
}

export const formatFolderList = (folders: readonly string[]): string => folders.join('\n');

/** What has to happen after settings change. Hover delay and depth are read live and need nothing. */
export interface SettingsImpact {
	/** Keys or the set of indexed files changed. */
	readonly reindex: boolean;
	/** Which notes are scanned for marks changed, so open views must redraw. */
	readonly refreshViews: boolean;
}

export function settingsImpact(previous: KeyringSettings, next: KeyringSettings): SettingsImpact {
	const foldersChanged =
		previous.excludedFolders.length !== next.excludedFolders.length ||
		previous.excludedFolders.some((folder, i) => folder !== next.excludedFolders[i]);
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
