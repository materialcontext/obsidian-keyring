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

/** The original per-character scanner, kept as an executable specification. */
function referenceParse(text: string): [number, number][] {
	const spans: [number, number][] = [];
	let open = -1;
	let i = 0;
	while (i < text.length - 1) {
		if (text[i] === '\n') {
			open = -1;
			i += 1;
		} else if (text.startsWith('{{', i)) {
			open = i;
			i += 1;
		} else if (open !== -1 && text.startsWith('}}', i)) {
			const inner = text.slice(open + 2, i);
			const target = inner.split('|')[0] ?? '';
			if (target.trim() !== '') spans.push([open, i + 2]);
			open = -1;
			i += 2;
		} else {
			i += 1;
		}
	}
	return spans;
}

function seeded(seed: number): () => number {
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
}

describe('parseMarks agrees with the reference scanner', () => {
	it('on 5000 random strings over { } | a space newline', () => {
		const random = seeded(42);
		const alphabet = ['{', '}', '|', 'a', ' ', '\n'];
		for (let n = 0; n < 5000; n++) {
			const length = Math.floor(random() * 40);
			let text = '';
			for (let i = 0; i < length; i++)
				text += alphabet[Math.floor(random() * alphabet.length)];
			const spans = parseMarks(text).map((m): [number, number] => [m.from, m.to]);
			expect(spans, JSON.stringify(text)).toEqual(referenceParse(text));
		}
	});
});

describe('parseMarks offset', () => {
	it('adds the offset to every position', () => {
		const text = 'x {{a|b}}';
		const [plain] = parseMarks(text);
		const [shifted] = parseMarks(text, 100);
		expect(shifted).toEqual({
			...plain,
			from: plain!.from + 100,
			to: plain!.to + 100,
			displayFrom: plain!.displayFrom + 100,
			displayTo: plain!.displayTo + 100,
		});
	});
});

describe('parseMarks whitespace', () => {
	it('trims Unicode whitespace as well as ASCII', () => {
		expect(parseMarks('{{ term |　shown\t}}')[0]).toMatchObject({
			target: 'term',
			display: 'shown',
		});
	});
});
