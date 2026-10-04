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

/** One change to the index, as data, so changes can be queued and applied in a single batch. */
export type IndexOp =
	/** Replace everything for `path`. `sections` must all belong to `path`. */
	| { readonly kind: 'set'; readonly path: string; readonly sections: readonly SectionRef[] }
	| { readonly kind: 'remove'; readonly path: string }
	/** Move `from`'s sections to `to`, replacing anything already at `to`. */
	| { readonly kind: 'rename'; readonly from: string; readonly to: string };

export interface IndexStats {
	readonly keys: number;
	readonly files: number;
	readonly sections: number;
}

interface Draft {
	readonly byKey: Map<Key, readonly SectionRef[]>;
	readonly byPath: Map<string, readonly Key[]>;
}

export function emptyIndex(options: NormalizeOptions): TermIndex {
	return { options, byKey: new Map(), byPath: new Map() };
}

export function lookup(index: TermIndex, target: string): readonly SectionRef[] {
	return index.byKey.get(normalizeKey(target, index.options)) ?? [];
}

/**
 * Apply `ops` in order. The maps are copied at most once per call, so a batch
 * of N ops costs one copy rather than N. Returns `index` itself when no op
 * changes anything.
 */
export function applyOps(index: TermIndex, ops: Iterable<IndexOp>): TermIndex {
	let draft: Draft | null = null;
	for (const op of ops) {
		if (!changes(draft ?? index, op)) continue;
		draft ??= { byKey: new Map(index.byKey), byPath: new Map(index.byPath) };
		apply(draft, op, index.options);
	}
	return draft === null ? index : { options: index.options, ...draft };
}

export const withFile = (
	index: TermIndex,
	path: string,
	sections: readonly SectionRef[],
): TermIndex => applyOps(index, [{ kind: 'set', path, sections }]);

export const withoutFile = (index: TermIndex, path: string): TermIndex =>
	applyOps(index, [{ kind: 'remove', path }]);

export const renamed = (index: TermIndex, from: string, to: string): TermIndex =>
	applyOps(index, [{ kind: 'rename', from, to }]);

export function stats(index: TermIndex): IndexStats {
	let sections = 0;
	for (const refs of index.byKey.values()) sections += refs.length;
	return { keys: index.byKey.size, files: index.byPath.size, sections };
}

function changes(view: Pick<TermIndex, 'byPath'>, op: IndexOp): boolean {
	switch (op.kind) {
		case 'set':
			return true;
		case 'remove':
			return view.byPath.has(op.path);
		case 'rename':
			return op.from !== op.to && view.byPath.has(op.from);
	}
}

function apply(draft: Draft, op: IndexOp, options: NormalizeOptions): void {
	switch (op.kind) {
		case 'set':
			return setFile(draft, op.path, op.sections, options);
		case 'remove':
			return removeFile(draft, op.path);
		case 'rename':
			return renameFile(draft, op.from, op.to);
	}
}

function setFile(
	draft: Draft,
	path: string,
	sections: readonly SectionRef[],
	options: NormalizeOptions,
): void {
	removeFile(draft, path);
	const keys = new Set<Key>();
	for (const section of sections) {
		const key = normalizeKey(section.heading, options);
		// An empty key can never be looked up: marks with empty targets aren't parsed.
		if (key === '') continue;
		keys.add(key);
		draft.byKey.set(key, [...(draft.byKey.get(key) ?? []), section]);
	}
	draft.byPath.set(path, [...keys]);
}

function removeFile(draft: Draft, path: string): void {
	for (const key of draft.byPath.get(path) ?? []) {
		const rest = (draft.byKey.get(key) ?? []).filter((s) => s.path !== path);
		if (rest.length === 0) draft.byKey.delete(key);
		else draft.byKey.set(key, rest);
	}
	draft.byPath.delete(path);
}

function renameFile(draft: Draft, from: string, to: string): void {
	const keys = draft.byPath.get(from) ?? [];
	removeFile(draft, to);
	for (const key of keys) {
		const moved = (draft.byKey.get(key) ?? []).map((s) =>
			s.path === from ? { ...s, path: to } : s,
		);
		draft.byKey.set(key, moved);
	}
	draft.byPath.delete(from);
	draft.byPath.set(to, keys);
}
