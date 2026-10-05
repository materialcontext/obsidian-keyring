import { describe, expect, it } from 'vitest';
import { normalizeKey } from '../../src/core/normalize';

const folded = { caseSensitive: false };
const exact = { caseSensitive: true };

describe('normalizeKey', () => {
	it('removes all whitespace, including inner, tabs and non-breaking spaces', () => {
		expect(normalizeKey('  New\tYork City \n', folded)).toBe('newyorkcity');
	});

	it('case-folds by default', () => {
		expect(normalizeKey('Treaty Name', folded)).toBe(normalizeKey('treaty name', folded));
		expect(normalizeKey('ÉCOLE', folded)).toBe('école');
	});

	it('keeps case when case-sensitive', () => {
		expect(normalizeKey('Treaty Name', exact)).toBe('TreatyName');
		expect(normalizeKey('Heading', exact)).not.toBe(normalizeKey('heading', exact));
	});

	it('treats composed and decomposed accents as equal', () => {
		expect(normalizeKey('café', folded)).toBe(normalizeKey('café', folded));
	});

	it('keeps markdown punctuation: headings match on raw text', () => {
		expect(normalizeKey('**Bold** term', folded)).toBe('**bold**term');
	});

	it('is idempotent', () => {
		const once = normalizeKey(' A b ', folded);
		expect(normalizeKey(once, folded)).toBe(once);
	});

	it('maps whitespace-only text to the empty key', () => {
		expect(normalizeKey(' \t ', folded)).toBe('');
	});
});
