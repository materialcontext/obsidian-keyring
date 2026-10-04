import type { MarkRange } from './types';

const OPEN = '{{';
const CLOSE = '}}';
const PIPE = '|'.charCodeAt(0);

interface Span {
	readonly from: number;
	readonly to: number;
}

/**
 * Find every mark in `text`. A mark never spans a newline, and marks don't
 * nest: the innermost `{{` before a `}}` wins, so `{{a {{b}}` yields `b`.
 * Marks with an empty target are not marks.
 *
 * Jumps between `{{`, `}}` and newlines with `indexOf`, reusing each search
 * result until the scan passes it, so text without marks costs a few native
 * scans (see docs/PERFORMANCE.md, P5).
 *
 * `offset` is added to every position, for text sliced from a larger document.
 */
export function parseMarks(text: string, offset = 0): MarkRange[] {
	const marks: MarkRange[] = [];
	let open = -1;
	let pos = 0;
	let nextOpen = text.indexOf(OPEN);
	let nextClose = text.indexOf(CLOSE);
	let nextLine = text.indexOf('\n');

	while (nextOpen !== -1 || nextClose !== -1) {
		const at = Math.min(orEnd(nextOpen, text), orEnd(nextClose, text), orEnd(nextLine, text));
		if (at === nextLine) {
			open = -1;
			pos = at + 1;
		} else if (at === nextOpen) {
			// Step by one so `{{{` opens at the last pair.
			open = at;
			pos = at + 1;
		} else {
			if (open !== -1) {
				const mark = toMark(text, open, at + CLOSE.length, offset);
				if (mark) marks.push(mark);
			}
			open = -1;
			pos = at + CLOSE.length;
		}
		if (nextOpen !== -1 && nextOpen < pos) nextOpen = text.indexOf(OPEN, pos);
		if (nextClose !== -1 && nextClose < pos) nextClose = text.indexOf(CLOSE, pos);
		if (nextLine !== -1 && nextLine < pos) nextLine = text.indexOf('\n', pos);
	}
	return marks;
}

const orEnd = (index: number, text: string): number => (index === -1 ? text.length : index);

function toMark(text: string, from: number, to: number, offset: number): MarkRange | null {
	const innerFrom = from + OPEN.length;
	const innerTo = to - CLOSE.length;
	// Search only inside the mark: an unbounded indexOf would scan to the end of
	// `text` for every mark without a pipe.
	let pipe = innerFrom;
	while (pipe < innerTo && text.charCodeAt(pipe) !== PIPE) pipe += 1;
	const hasPipe = pipe < innerTo;

	const target = trim(text, { from: innerFrom, to: hasPipe ? pipe : innerTo });
	if (isEmpty(target)) return null;

	const display = hasPipe ? trim(text, { from: pipe + 1, to: innerTo }) : target;
	const shown = isEmpty(display) ? target : display;

	return {
		from: from + offset,
		to: to + offset,
		target: slice(text, target),
		display: slice(text, shown),
		displayFrom: shown.from + offset,
		displayTo: shown.to + offset,
	};
}

function trim(text: string, { from, to }: Span): Span {
	while (from < to && isSpace(text[from])) from += 1;
	while (to > from && isSpace(text[to - 1])) to -= 1;
	return { from, to };
}

/** ASCII whitespace by char code; the Unicode regex only for non-ASCII characters. */
function isSpace(ch: string | undefined): boolean {
	if (ch === undefined) return false;
	const code = ch.charCodeAt(0);
	if (code < 128) return code === 32 || (code >= 9 && code <= 13);
	return /\s/u.test(ch);
}
const isEmpty = ({ from, to }: Span): boolean => from >= to;
const slice = (text: string, { from, to }: Span): string => text.slice(from, to);
