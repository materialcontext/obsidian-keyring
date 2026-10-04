import { describe, expect, it } from 'vitest';
import { sectionsFromHeadings } from '../../src/core/sections';
import { bodyOf, headingsOf } from '../helpers';

const sectionsOf = (markdown: string) => sectionsFromHeadings('note.md', headingsOf(markdown));

describe('sectionsFromHeadings', () => {
	it('returns nothing for a file without headings', () => {
		expect(sectionsFromHeadings('note.md', [])).toEqual([]);
	});

	it('runs the last section to end of file', () => {
		const md = '# Only\nbody line\nmore';
		const [only] = sectionsOf(md);
		expect(only?.bodyEnd).toBeNull();
		expect(only && bodyOf(md, only)).toBe('body line\nmore');
	});

	it('ends a section at the next heading of equal or higher priority', () => {
		const md = [
			'# A', // 0
			'a',
			'## A.1', // 1
			'a1',
			'### A.1.x', // 2
			'a1x',
			'## A.2', // 3
			'a2',
			'# B', // 4
			'b',
		].join('\n');
		const bodies = sectionsOf(md).map((s) => [s.heading, bodyOf(md, s)]);
		expect(bodies).toEqual([
			['A', 'a\n## A.1\na1\n### A.1.x\na1x\n## A.2\na2'],
			['A.1', 'a1\n### A.1.x\na1x'],
			['A.1.x', 'a1x'],
			['A.2', 'a2'],
			['B', 'b'],
		]);
	});

	it('closes a deeper section when a shallower heading skips levels', () => {
		const md = '# Top\nt\n### Deep\nd\n## Mid\nm';
		const bodies = sectionsOf(md).map((s) => [s.heading, bodyOf(md, s)]);
		expect(bodies).toEqual([
			['Top', 't\n### Deep\nd\n## Mid\nm'],
			['Deep', 'd'],
			['Mid', 'm'],
		]);
	});

	it('handles a file that starts below level 1', () => {
		const md = '### Three\nx\n## Two\ny';
		expect(sectionsOf(md).map((s) => bodyOf(md, s))).toEqual(['x', 'y']);
	});

	it('keeps duplicate headings in the same file as separate sections', () => {
		const md = '## Term\nfirst\n## Term\nsecond';
		const sections = sectionsOf(md);
		expect(sections.map((s) => s.heading)).toEqual(['Term', 'Term']);
		expect(sections.map((s) => bodyOf(md, s))).toEqual(['first', 'second']);
	});

	it('gives an empty body to a heading followed directly by a sibling', () => {
		const md = '## Empty\n## Next\ntext';
		expect(sectionsOf(md).map((s) => bodyOf(md, s))).toEqual(['', 'text']);
	});

	it('sorts input by offset first', () => {
		const md = '# A\na\n# B\nb';
		const reversed = [...headingsOf(md)].reverse();
		const sections = sectionsFromHeadings('note.md', reversed);
		expect(sections.map((s) => bodyOf(md, s))).toEqual(['a', 'b']);
	});

	it('carries path, raw heading text and level', () => {
		const [s] = sectionsFromHeadings('dir/n.md', headingsOf('## Some *term*\nx'));
		expect(s).toMatchObject({ path: 'dir/n.md', heading: 'Some *term*', level: 2 });
	});
});
