import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	HOVER_DELAY_MS,
	NESTING_DEPTH,
	rangeError,
	sanitizeSettings,
	settingsImpact,
	type KeyringSettings,
} from '../../src/core/settings';

describe('sanitizeSettings', () => {
	it('returns defaults for missing data', () => {
		expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(sanitizeSettings('junk')).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps valid fields and fills the rest', () => {
		expect(sanitizeSettings({ hoverDelayMs: 500 })).toEqual({
			...DEFAULT_SETTINGS,
			hoverDelayMs: 500,
		});
	});

	it('falls back per field for invalid values', () => {
		expect(
			sanitizeSettings({
				caseSensitive: 'yes',
				hoverDelayMs: -1,
				maxNestingDepth: 2.5,
				excludedFolders: 'Templates',
			}),
		).toEqual(DEFAULT_SETTINGS);
		expect(sanitizeSettings({ hoverDelayMs: HOVER_DELAY_MS.max + 1 }).hoverDelayMs).toBe(300);
	});

	it('drops non-string folder entries', () => {
		expect(sanitizeSettings({ excludedFolders: ['A', 3, null, 'B'] }).excludedFolders).toEqual([
			'A',
			'B',
		]);
	});

	it('ignores unknown keys', () => {
		expect(sanitizeSettings({ ...DEFAULT_SETTINGS, stale: true })).toEqual(DEFAULT_SETTINGS);
	});
});

describe('rangeError', () => {
	it('accepts whole numbers within range', () => {
		expect(rangeError(0, HOVER_DELAY_MS)).toBeUndefined();
		expect(rangeError(5000, HOVER_DELAY_MS)).toBeUndefined();
		expect(rangeError(20, NESTING_DEPTH)).toBeUndefined();
	});

	it('explains anything else', () => {
		for (const value of [-1, 1.5, 21, 0, NaN, Infinity, null, undefined, '3']) {
			expect(rangeError(value, NESTING_DEPTH), String(value)).toBe(
				'Enter a whole number from 1 to 20.',
			);
		}
	});
});

describe('settingsImpact', () => {
	const base: KeyringSettings = { ...DEFAULT_SETTINGS, excludedFolders: ['Templates'] };

	it('needs nothing for delay or depth changes', () => {
		expect(settingsImpact(base, { ...base, hoverDelayMs: 50, maxNestingDepth: 2 })).toEqual({
			reindex: false,
			refreshViews: false,
		});
	});

	it('reindexes when case sensitivity changes', () => {
		expect(settingsImpact(base, { ...base, caseSensitive: true })).toEqual({
			reindex: true,
			refreshViews: false,
		});
	});

	it('reindexes and refreshes views when excluded folders change', () => {
		const expected = { reindex: true, refreshViews: true };
		expect(settingsImpact(base, { ...base, excludedFolders: ['Other'] })).toEqual(expected);
		expect(settingsImpact(base, { ...base, excludedFolders: [] })).toEqual(expected);
		expect(settingsImpact(base, { ...base, excludedFolders: ['Templates', 'X'] })).toEqual(
			expected,
		);
	});

	it('treats an equal folder list as unchanged', () => {
		expect(settingsImpact(base, { ...base, excludedFolders: ['Templates'] }).reindex).toBe(
			false,
		);
	});
});
