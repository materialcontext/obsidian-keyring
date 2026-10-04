import { describe, expect, it } from 'vitest';
import {
	basename,
	isIndexable,
	isUnder,
	opForRename,
	pathRules,
	rebase,
} from '../../src/core/paths';
import { section } from '../helpers';

const rules = pathRules(['Templates', ' /Archive/Old/ ', '', '  ']);
const sectionsAt = (path: string) => [section(path, 'Fresh')];

describe('pathRules', () => {
	it('trims entries, strips slashes and drops blanks', () => {
		expect(rules.excludedFolders).toEqual(['Templates', 'Archive/Old']);
	});
});

describe('isUnder', () => {
	it('matches the folder itself and anything inside it', () => {
		expect(isUnder('Templates/daily.md', 'Templates')).toBe(true);
		expect(isUnder('Templates/sub/x.md', 'Templates')).toBe(true);
		expect(isUnder('Templates', 'Templates')).toBe(true);
	});

	it('does not match a sibling that shares a prefix', () => {
		expect(isUnder('Templates2/x.md', 'Templates')).toBe(false);
		expect(isUnder('notes/Templates/x.md', 'Templates')).toBe(false);
	});

	it('treats the empty folder as the vault root', () => {
		expect(isUnder('any/where.md', '')).toBe(true);
	});
});

describe('isIndexable', () => {
	it('accepts markdown outside excluded folders', () => {
		expect(isIndexable('notes/a.md', rules)).toBe(true);
		expect(isIndexable('Archive/a.md', rules)).toBe(true);
	});

	it('rejects excluded folders, nested ones included', () => {
		expect(isIndexable('Templates/daily.md', rules)).toBe(false);
		expect(isIndexable('Archive/Old/deep/a.md', rules)).toBe(false);
	});

	it('rejects non-markdown files', () => {
		expect(isIndexable('notes/a.canvas', rules)).toBe(false);
		expect(isIndexable('notes/a.md.bak', rules)).toBe(false);
	});
});

describe('rebase', () => {
	it('moves a path from one folder to another', () => {
		expect(rebase('old/sub/a.md', 'old', 'new/place')).toBe('new/place/sub/a.md');
	});
});

describe('opForRename', () => {
	it('renames between indexable paths', () => {
		expect(opForRename('a.md', 'b/a.md', rules, sectionsAt)).toEqual({
			kind: 'rename',
			from: 'a.md',
			to: 'b/a.md',
		});
	});

	it('removes a file moved into an excluded folder', () => {
		expect(opForRename('a.md', 'Templates/a.md', rules, sectionsAt)).toEqual({
			kind: 'remove',
			path: 'a.md',
		});
	});

	it('indexes a file moved out of an excluded folder afresh', () => {
		expect(opForRename('Templates/a.md', 'a.md', rules, sectionsAt)).toEqual({
			kind: 'set',
			path: 'a.md',
			sections: [section('a.md', 'Fresh')],
		});
	});

	it('handles extension changes', () => {
		expect(opForRename('a.md', 'a.txt', rules, sectionsAt).kind).toBe('remove');
		expect(opForRename('a.txt', 'a.md', rules, sectionsAt).kind).toBe('set');
	});

	it('only reads sections when it needs them', () => {
		let calls = 0;
		const counting = (path: string) => (calls++, sectionsAt(path));
		opForRename('a.md', 'b.md', rules, counting);
		opForRename('a.md', 'Templates/a.md', rules, counting);
		expect(calls).toBe(0);
	});
});

describe('basename', () => {
	it('drops the folder and the .md extension', () => {
		expect(basename('a/b/Note name.md')).toBe('Note name');
		expect(basename('top.md')).toBe('top');
	});

	it('keeps other extensions and dots inside the name', () => {
		expect(basename('a/v1.2 notes.md')).toBe('v1.2 notes');
		expect(basename('a/file.canvas')).toBe('file.canvas');
	});
});
