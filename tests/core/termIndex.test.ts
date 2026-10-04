import { describe, expect, it } from 'vitest';
import {
	applyOps,
	emptyIndex,
	lookup,
	renamed,
	stats,
	withFile,
	withoutFile,
	type TermIndex,
} from '../../src/core/termIndex';
import { section } from '../helpers';

const folded = { caseSensitive: false };

function indexOf(files: Record<string, string[]>, options = folded): TermIndex {
	return Object.entries(files).reduce(
		(index, [path, headings]) =>
			withFile(
				index,
				path,
				headings.map((h, i) => section(path, h, i * 10)),
			),
		emptyIndex(options),
	);
}

const paths = (index: TermIndex, target: string): string[] =>
	lookup(index, target).map((s) => s.path);

describe('termIndex', () => {
	it('looks up by normalized key', () => {
		const index = indexOf({ 'a.md': ['New York'] });
		expect(paths(index, 'new york')).toEqual(['a.md']);
		expect(paths(index, 'NEWYORK')).toEqual(['a.md']);
		expect(paths(index, 'Boston')).toEqual([]);
	});

	it('respects case sensitivity', () => {
		const index = indexOf({ 'a.md': ['Term'] }, { caseSensitive: true });
		expect(paths(index, 'Term')).toEqual(['a.md']);
		expect(paths(index, 'term')).toEqual([]);
	});

	it('collects matching sections across files and duplicates within a file', () => {
		const index = indexOf({ 'a.md': ['Term', 'Other', 'term'], 'b.md': ['TERM'] });
		expect(paths(index, 'term')).toEqual(['a.md', 'a.md', 'b.md']);
		expect(index.byPath.get('a.md')).toEqual(['term', 'other']);
	});

	it('indexes files without headings so they count as files', () => {
		const index = indexOf({ 'empty.md': [] });
		expect(index.byPath.get('empty.md')).toEqual([]);
		expect(stats(index)).toEqual({ keys: 0, files: 1, sections: 0 });
	});

	it('skips headings with an empty key', () => {
		const index = indexOf({ 'a.md': ['  ', 'Real'] });
		expect([...index.byKey.keys()]).toEqual(['real']);
	});

	describe('withFile', () => {
		it('replaces a file’s previous sections', () => {
			const before = indexOf({ 'a.md': ['Old', 'Shared'], 'b.md': ['Shared'] });
			const after = withFile(before, 'a.md', [section('a.md', 'New')]);
			expect(paths(after, 'old')).toEqual([]);
			expect(paths(after, 'new')).toEqual(['a.md']);
			expect(paths(after, 'shared')).toEqual(['b.md']);
			expect(after.byKey.has('old' as never)).toBe(false);
		});

		it('does not mutate its input', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			withFile(before, 'a.md', [section('a.md', 'Other')]);
			withFile(before, 'b.md', [section('b.md', 'Term')]);
			expect(paths(before, 'term')).toEqual(['a.md']);
			expect(before.byPath.size).toBe(1);
		});
	});

	describe('withoutFile', () => {
		it('removes the file and drops keys left empty', () => {
			const before = indexOf({ 'a.md': ['Only A', 'Shared'], 'b.md': ['Shared'] });
			const after = withoutFile(before, 'a.md');
			expect(after.byPath.has('a.md')).toBe(false);
			expect(after.byKey.has('onlya' as never)).toBe(false);
			expect(paths(after, 'shared')).toEqual(['b.md']);
			expect(stats(after)).toEqual({ keys: 1, files: 1, sections: 1 });
		});

		it('returns the same index for an unknown path', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			expect(withoutFile(before, 'missing.md')).toBe(before);
		});

		it('does not mutate its input', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			withoutFile(before, 'a.md');
			expect(paths(before, 'term')).toEqual(['a.md']);
		});
	});

	describe('renamed', () => {
		it('moves sections and the path entry', () => {
			const before = indexOf({ 'old.md': ['Term', 'Other'], 'b.md': ['Term'] });
			const after = renamed(before, 'old.md', 'dir/new.md');
			expect(paths(after, 'term')).toEqual(['dir/new.md', 'b.md']);
			expect(paths(after, 'other')).toEqual(['dir/new.md']);
			expect(after.byPath.has('old.md')).toBe(false);
			expect(after.byPath.get('dir/new.md')).toEqual(['term', 'other']);
		});

		it('keeps offsets and headings', () => {
			const before = indexOf({ 'old.md': ['A', 'B'] });
			const after = renamed(before, 'old.md', 'new.md');
			expect(lookup(after, 'b')).toEqual([{ ...section('new.md', 'B', 10) }]);
		});

		it('replaces anything already indexed at the destination', () => {
			const before = indexOf({ 'old.md': ['Term'], 'new.md': ['Stale'] });
			const after = renamed(before, 'old.md', 'new.md');
			expect(paths(after, 'stale')).toEqual([]);
			expect(paths(after, 'term')).toEqual(['new.md']);
			expect(stats(after)).toEqual({ keys: 1, files: 1, sections: 1 });
		});

		it('returns the same index for an unknown path or a no-op rename', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			expect(renamed(before, 'missing.md', 'x.md')).toBe(before);
			expect(renamed(before, 'a.md', 'a.md')).toBe(before);
		});

		it('does not mutate its input', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			renamed(before, 'a.md', 'b.md');
			expect(paths(before, 'term')).toEqual(['a.md']);
			expect(before.byPath.has('a.md')).toBe(true);
		});
	});

	it('stats counts keys, files and sections', () => {
		const index = indexOf({ 'a.md': ['X', 'Y', 'x'], 'b.md': ['Y'] });
		expect(stats(index)).toEqual({ keys: 2, files: 2, sections: 4 });
	});

	describe('applyOps', () => {
		it('applies ops in order', () => {
			const index = applyOps(emptyIndex(folded), [
				{ kind: 'set', path: 'a.md', sections: [section('a.md', 'Term')] },
				{ kind: 'rename', from: 'a.md', to: 'b.md' },
				{ kind: 'set', path: 'c.md', sections: [section('c.md', 'Term')] },
				{ kind: 'remove', path: 'c.md' },
			]);
			expect(paths(index, 'term')).toEqual(['b.md']);
			expect([...index.byPath.keys()]).toEqual(['b.md']);
		});

		it('matches applying the same ops one at a time', () => {
			const start = indexOf({ 'a.md': ['X', 'Y'], 'b.md': ['Y'] });
			const batched = applyOps(start, [
				{ kind: 'rename', from: 'a.md', to: 'z.md' },
				{ kind: 'set', path: 'b.md', sections: [section('b.md', 'X')] },
				{ kind: 'remove', path: 'missing.md' },
			]);
			const stepwise = withFile(renamed(start, 'a.md', 'z.md'), 'b.md', [
				section('b.md', 'X'),
			]);
			expect(batched.byKey).toEqual(stepwise.byKey);
			expect(batched.byPath).toEqual(stepwise.byPath);
		});

		it('returns the same index when nothing changes', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			expect(applyOps(before, [])).toBe(before);
			expect(
				applyOps(before, [
					{ kind: 'remove', path: 'missing.md' },
					{ kind: 'rename', from: 'missing.md', to: 'x.md' },
				]),
			).toBe(before);
		});

		it('sees earlier ops in the same batch', () => {
			const index = applyOps(emptyIndex(folded), [
				{ kind: 'set', path: 'new.md', sections: [section('new.md', 'Term')] },
				{ kind: 'remove', path: 'new.md' },
			]);
			expect(stats(index)).toEqual({ keys: 0, files: 0, sections: 0 });
		});

		it('does not mutate its input', () => {
			const before = indexOf({ 'a.md': ['Term'] });
			applyOps(before, [
				{ kind: 'remove', path: 'a.md' },
				{ kind: 'set', path: 'b.md', sections: [section('b.md', 'Other')] },
			]);
			expect(paths(before, 'term')).toEqual(['a.md']);
			expect([...before.byPath.keys()]).toEqual(['a.md']);
		});
	});
});
