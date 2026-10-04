import type { MarkRange } from './types';

const OPEN = '{{';
const CLOSE = '}}';

interface Span {
	readonly from: number;
	readonly to: number;
}

/**
 * Find every mark in `text`. A mark never spans a newline, and marks don't
 * nest: the innermost `{{` before a `}}` wins, so `{{a {{b}}` yields `b`.
 * Marks with an empty target are not marks.
 */
export function parseMarks(text: string): MarkRange[] {
	const marks: MarkRange[] = [];
	let open = -1;
	let i = 0;
	while (i < text.length - 1) {
		if (text[i] === '\n') {
			open = -1;
			i += 1;
		} else if (text.startsWith(OPEN, i)) {
			// Step by one so `{{{` opens at the last pair.
			open = i;
			i += 1;
		} else if (open !== -1 && text.startsWith(CLOSE, i)) {
			const mark = toMark(text, open, i + CLOSE.length);
			if (mark) marks.push(mark);
			open = -1;
			i += CLOSE.length;
		} else {
			i += 1;
		}
	}
	return marks;
}

function toMark(text: string, from: number, to: number): MarkRange | null {
	const innerFrom = from + OPEN.length;
	const innerTo = to - CLOSE.length;
	const pipe = text.indexOf('|', innerFrom);
	const hasPipe = pipe !== -1 && pipe < innerTo;

	const target = trim(text, { from: innerFrom, to: hasPipe ? pipe : innerTo });
	if (isEmpty(target)) return null;

	const display = hasPipe ? trim(text, { from: pipe + 1, to: innerTo }) : target;
	const shown = isEmpty(display) ? target : display;

	return {
		from,
		to,
		target: slice(text, target),
		display: slice(text, shown),
		displayFrom: shown.from,
		displayTo: shown.to,
	};
}

function trim(text: string, { from, to }: Span): Span {
	while (from < to && isSpace(text[from])) from += 1;
	while (to > from && isSpace(text[to - 1])) to -= 1;
	return { from, to };
}

const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/u.test(ch);
const isEmpty = ({ from, to }: Span): boolean => from >= to;
const slice = (text: string, { from, to }: Span): string => text.slice(from, to);
