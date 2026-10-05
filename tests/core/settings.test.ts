import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	formatFolderList,
	HOVER_DELAY_MS,
	NESTING_DEPTH,
	parseBoundedInt,
	parseFolderList,
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

describe('parseBoundedInt', () => {
	it('accepts whole numbers within range, trimmed', () => {
		expect(parseBoundedInt(' 250 ', HOVER_DELAY_MS)).toBe(250);
		expect(parseBoundedInt('0', HOVER_DELAY_MS)).toBe(0);
		expect(parseBoundedInt('20', NESTING_DEPTH)).toBe(20);
	});

	it('rejects anything else', () => {
		for (const text of ['', ' ', '-1', '1.5', '1e3', 'abc', '0x10', '21']) {
			expect(parseBoundedInt(text, NESTING_DEPTH), text).toBeNull();
		}
		expect(parseBoundedInt('0', NESTING_DEPTH)).toBeNull();
	});
});

describe('parseFolderList / formatFolderList', () => {
	it('takes one folder per line, dropping blanks and repeats', () => {
		expect(parseFolderList('Templates\n\n  Archive/Old  \nTemplates\n')).toEqual([
			'Templates',
			'Archive/Old',
		]);
	});

	it('round-trips', () => {
		const folders = ['A', 'B/C'];
		expect(parseFolderList(formatFolderList(folders))).toEqual(folders);
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
