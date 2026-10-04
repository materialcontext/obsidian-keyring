import { describe, expect, it } from 'vitest';
import { orderEntries } from '../../src/core/order';
import { section } from '../helpers';

const labels = (entries: { path: string; bodyStart: number }[]) =>
	entries.map((e) => `${e.path}@${e.bodyStart}`);

describe('orderEntries', () => {
	const entries = [
		section('b.md', 'T', 50),
		section('current.md', 'T', 90),
		section('a.md', 'T', 5),
		section('b.md', 'T', 10),
		section('current.md', 'T', 20),
	];

	it('puts the current file first, then sorts by path, then by position', () => {
		expect(labels(orderEntries(entries, 'current.md'))).toEqual([
			'current.md@20',
			'current.md@90',
			'a.md@5',
			'b.md@10',
			'b.md@50',
		]);
	});

	it('sorts by path alone when the current file has no entries', () => {
		expect(labels(orderEntries(entries, 'elsewhere.md'))[0]).toBe('a.md@5');
	});

	it('uses locale order for paths', () => {
		const mixed = [section('b.md', 'T'), section('B.md', 'T'), section('a.md', 'T')];
		const expected = [...mixed].map((e) => e.path).sort((x, y) => x.localeCompare(y));
		expect(orderEntries(mixed, '').map((e) => e.path)).toEqual(expected);
	});

	it('does not mutate its input', () => {
		const copy = [...entries];
		orderEntries(entries, 'current.md');
		expect(entries).toEqual(copy);
	});
});
