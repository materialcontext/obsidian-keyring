import { describe, expect, it } from 'vitest';
import { compareSections, orderEntries, sortSections } from '../../src/core/order';
import { section } from '../helpers';

const labels = (entries: readonly { path: string; bodyStart: number }[]) =>
	entries.map((e) => `${e.path}@${e.bodyStart}`);

describe('compareSections / sortSections', () => {
	it('sorts by path, then by position', () => {
		const sorted = sortSections([
			section('b.md', 'T', 50),
			section('a.md', 'T', 5),
			section('b.md', 'T', 10),
		]);
		expect(labels(sorted)).toEqual(['a.md@5', 'b.md@10', 'b.md@50']);
	});

	it('uses locale order for paths', () => {
		const paths = ['b.md', 'B.md', 'a.md', 'é.md', 'e.md'];
		const sorted = sortSections(paths.map((p) => section(p, 'T'))).map((e) => e.path);
		expect(sorted).toEqual([...paths].sort((x, y) => x.localeCompare(y)));
	});

	it('is zero only for the same path and position', () => {
		expect(compareSections(section('a.md', 'X', 3), section('a.md', 'Y', 3))).toBe(0);
		expect(compareSections(section('a.md', 'X', 3), section('a.md', 'X', 4))).toBeLessThan(0);
	});
});

describe('orderEntries', () => {
	const entries = sortSections([
		section('b.md', 'T', 50),
		section('current.md', 'T', 90),
		section('a.md', 'T', 5),
		section('b.md', 'T', 10),
		section('current.md', 'T', 20),
	]);

	it('puts the current file first, keeping sorted order within each group', () => {
		expect(labels(orderEntries(entries, 'current.md'))).toEqual([
			'current.md@20',
			'current.md@90',
			'a.md@5',
			'b.md@10',
			'b.md@50',
		]);
	});

	it('returns the input unchanged when the current file has no entries', () => {
		expect(orderEntries(entries, 'elsewhere.md')).toBe(entries);
	});

	it('does not mutate its input', () => {
		const copy = [...entries];
		orderEntries(entries, 'current.md');
		expect(entries).toEqual(copy);
	});
});
