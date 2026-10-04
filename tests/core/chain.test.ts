import { describe, expect, it } from 'vitest';
import { decodeChain, encodeChain, nextChain } from '../../src/core/chain';
import type { Key } from '../../src/core/types';

const k = (...keys: string[]) => keys as Key[];

describe('nextChain', () => {
	it('starts a chain from a root popover', () => {
		expect(nextChain([], 'a' as Key, 5)).toEqual(['a']);
	});

	it('extends the chain', () => {
		expect(nextChain(k('a', 'b'), 'c' as Key, 5)).toEqual(['a', 'b', 'c']);
	});

	it('refuses a key already open in the chain', () => {
		expect(nextChain(k('a', 'b'), 'a' as Key, 5)).toBeNull();
		expect(nextChain(k('a', 'b'), 'b' as Key, 5)).toBeNull();
	});

	it('caps depth: a chain of maxDepth popovers opens no more', () => {
		expect(nextChain(k('a', 'b', 'c', 'd'), 'e' as Key, 5)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(nextChain(k('a', 'b', 'c', 'd', 'e'), 'f' as Key, 5)).toBeNull();
		expect(nextChain([], 'a' as Key, 0)).toBeNull();
	});

	it('does not mutate the parent chain', () => {
		const parent = k('a');
		nextChain(parent, 'b' as Key, 5);
		expect(parent).toEqual(['a']);
	});
});

describe('encodeChain / decodeChain', () => {
	it('round-trips, including awkward characters', () => {
		const chain = k('a"b', '{{x}}', 'é|ü');
		expect(decodeChain(encodeChain(chain))).toEqual(chain);
	});

	it('decodes anything unreadable as a root chain', () => {
		expect(decodeChain(undefined)).toEqual([]);
		expect(decodeChain('not json')).toEqual([]);
		expect(decodeChain('{"a":1}')).toEqual([]);
		expect(decodeChain('[1,2]')).toEqual([]);
	});
});
