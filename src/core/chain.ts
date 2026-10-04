import type { Key } from './types';

/**
 * The chain of keys open from a root popover down to a nested one. Opening
 * `key` from a popover whose chain is `parent` yields the child's chain, or
 * `null` when the key is already open in the chain (a cycle) or the chain is
 * already `maxDepth` long.
 */
export function nextChain(parent: readonly Key[], key: Key, maxDepth: number): Key[] | null {
	if (parent.length >= maxDepth || parent.includes(key)) return null;
	return [...parent, key];
}

/** Chains travel through the DOM as a `data-` attribute. */
export const encodeChain = (chain: readonly Key[]): string => JSON.stringify(chain);

/** Anything unreadable decodes to the empty chain, i.e. a root popover. */
export function decodeChain(raw: string | undefined): Key[] {
	if (raw === undefined) return [];
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value) && value.every((k) => typeof k === 'string')
			? (value as Key[])
			: [];
	} catch {
		return [];
	}
}
