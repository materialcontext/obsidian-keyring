import { describe, expect, it } from 'vitest';
import { parseMarks } from '../../src/core/marks';

const targets = (text: string): string[] => parseMarks(text).map((m) => m.target);

describe('parseMarks', () => {
	it('parses a plain mark with offsets covering the braces', () => {
		const text = 'see {{term}} here';
		expect(parseMarks(text)).toEqual([
			{ from: 4, to: 12, target: 'term', display: 'term', displayFrom: 6, displayTo: 10 },
		]);
	});

	it('parses the |display form', () => {
		const text = '{{target|shown text}}';
		const [mark] = parseMarks(text);
		expect(mark).toMatchObject({ target: 'target', display: 'shown text' });
		expect(text.slice(mark?.displayFrom, mark?.displayTo)).toBe('shown text');
	});

	it('splits on the first pipe only', () => {
		expect(parseMarks('{{a|b|c}}')[0]).toMatchObject({ target: 'a', display: 'b|c' });
	});

	it('falls back to the target when display is empty', () => {
		const text = '{{a | }}';
		const [mark] = parseMarks(text);
		expect(mark).toMatchObject({ target: 'a', display: 'a' });
		expect(text.slice(mark?.displayFrom, mark?.displayTo)).toBe('a');
	});

	it('trims target and display, and display offsets exclude the padding', () => {
		const text = '{{  spaced term  |  shown  }}';
		const [mark] = parseMarks(text);
		expect(mark).toMatchObject({ target: 'spaced term', display: 'shown' });
		expect(text.slice(mark?.displayFrom, mark?.displayTo)).toBe('shown');
	});

	it('finds adjacent marks', () => {
		expect(targets('{{a}}{{b}} {{c|d}}')).toEqual(['a', 'b', 'c']);
	});

	it('rejects empty targets', () => {
		expect(parseMarks('{{}} {{ }} {{|display}} {{ \t |x}}')).toEqual([]);
	});

	it('ignores an unclosed {{', () => {
		expect(parseMarks('{{never closed')).toEqual([]);
		expect(parseMarks('}} stray close {{')).toEqual([]);
	});

	it('lets the innermost {{ win, so marks never nest', () => {
		expect(targets('{{a {{b}}')).toEqual(['b']);
		expect(targets('{{a {{b}} c}}')).toEqual(['b']);
	});

	it('does not span newlines', () => {
		expect(parseMarks('{{a\nb}}')).toEqual([]);
		expect(targets('{{a\n{{b}}')).toEqual(['b']);
		expect(targets('{{a}}\n{{b}}')).toEqual(['a', 'b']);
	});

	it('takes the last pair of an opening brace run', () => {
		const text = '{{{a}}}';
		const [mark] = parseMarks(text);
		expect(mark).toMatchObject({ from: 1, to: 6, target: 'a' });
	});

	it('allows single braces inside the target', () => {
		expect(targets('{{a}b}}')).toEqual(['a}b']);
	});

	it('keeps formatting characters as raw text', () => {
		expect(targets('{{**bold**}}')).toEqual(['**bold**']);
	});

	it('uses UTF-16 offsets', () => {
		const text = '😀 {{ключ}}';
		const [mark] = parseMarks(text);
		expect(text.slice(mark?.from, mark?.to)).toBe('{{ключ}}');
	});

	it('every mark slice starts with {{ and ends with }}', () => {
		const samples = ['{{a}}{{b|c}}', 'x {{ y }} z {{{w}}}', '{{p {{q|r}} s}} {{t}}'];
		for (const text of samples) {
			for (const mark of parseMarks(text)) {
				const raw = text.slice(mark.from, mark.to);
				expect(raw.startsWith('{{') && raw.endsWith('}}')).toBe(true);
				expect(mark.from <= mark.displayFrom && mark.displayTo <= mark.to).toBe(true);
			}
		}
	});
});
