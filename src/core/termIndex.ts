import { normalizeKey, type NormalizeOptions } from './normalize';
import type { Key, SectionRef } from './types';

/**
 * Immutable lookup from key to sections, plus the reverse map from path to
 * keys so one file can be replaced or removed without scanning everything.
 * Every update returns a new index and leaves its input untouched.
 */
export interface TermIndex {
	readonly options: NormalizeOptions;
	readonly byKey: ReadonlyMap<Key, readonly SectionRef[]>;
	readonly byPath: ReadonlyMap<string, readonly Key[]>;
}

export interface IndexStats {
	readonly keys: number;
	readonly files: number;
	readonly sections: number;
}

type MutableByKey = Map<Key, readonly SectionRef[]>;

export function emptyIndex(options: NormalizeOptions): TermIndex {
	return { options, byKey: new Map(), byPath: new Map() };
}

export function lookup(index: TermIndex, target: string): readonly SectionRef[] {
	return index.byKey.get(normalizeKey(target, index.options)) ?? [];
}

/** Replace everything indexed for `path` with `sections`, which must all belong to `path`. */
export function withFile(
	index: TermIndex,
	path: string,
	sections: readonly SectionRef[],
): TermIndex {
	const byKey: MutableByKey = new Map(index.byKey);
	dropPath(byKey, index.byPath.get(path) ?? [], path);

	const keys = new Set<Key>();
	for (const section of sections) {
		const key = normalizeKey(section.heading, index.options);
		// An empty key can never be looked up: marks with empty targets aren't parsed.
		if (key === '') continue;
		keys.add(key);
		byKey.set(key, [...(byKey.get(key) ?? []), section]);
	}

	const byPath = new Map(index.byPath).set(path, [...keys]);
	return { ...index, byKey, byPath };
}

export function withoutFile(index: TermIndex, path: string): TermIndex {
	const keys = index.byPath.get(path);
	if (keys === undefined) return index;

	const byKey: MutableByKey = new Map(index.byKey);
	dropPath(byKey, keys, path);

	const byPath = new Map(index.byPath);
	byPath.delete(path);
	return { ...index, byKey, byPath };
}

/** Move `oldPath`'s sections to `newPath`. Anything already at `newPath` is replaced. */
export function renamed(index: TermIndex, oldPath: string, newPath: string): TermIndex {
	const keys = index.byPath.get(oldPath);
	if (keys === undefined || oldPath === newPath) return index;

	const base = withoutFile(index, newPath);
	const byKey: MutableByKey = new Map(base.byKey);
	for (const key of keys) {
		const moved = (byKey.get(key) ?? []).map((s) =>
			s.path === oldPath ? { ...s, path: newPath } : s,
		);
		byKey.set(key, moved);
	}

	const byPath = new Map(base.byPath);
	byPath.delete(oldPath);
	byPath.set(newPath, keys);
	return { ...base, byKey, byPath };
}

export function stats(index: TermIndex): IndexStats {
	let sections = 0;
	for (const refs of index.byKey.values()) sections += refs.length;
	return { keys: index.byKey.size, files: index.byPath.size, sections };
}

/** Remove `path`'s sections under `keys` from a map this module owns. */
function dropPath(byKey: MutableByKey, keys: readonly Key[], path: string): void {
	for (const key of keys) {
		const rest = (byKey.get(key) ?? []).filter((s) => s.path !== path);
		if (rest.length === 0) byKey.delete(key);
		else byKey.set(key, rest);
	}
}
