import { isTouched } from './markLayout';
import { parseMarks } from './marks';
import type { MarkRange, Span } from './types';

/** Replace `from..to` of a line with `insert`. */
export interface LineEdit {
	readonly from: number;
	readonly to: number;
	readonly insert: string;
}

/** One edit to a line, and where the selection lands afterwards (in the edited line). */
export interface MarkToggle {
	readonly edit: LineEdit;
	readonly selection: Span;
}

/** Characters that make up a word for "wrap the word under the cursor". */
const WORD_CHAR = /[\p{L}\p{N}\p{M}_'’-]/u;

/**
 * Toggle a mark at `selection` within `line`, the way Ctrl-I toggles italics:
 * - The selection touches marks: unwrap them, keeping their visible text.
 * - Text is selected: wrap it, minus surrounding whitespace.
 * - The cursor is in a word: wrap the word.
 * - Otherwise: insert `{{}}` with the cursor inside.
 * Always one edit, so a caller can apply several lines' edits in one go.
 */
export function toggleMark(line: string, selection: Span): MarkToggle {
	const touched = parseMarks(line).filter((mark) => isTouched(mark, [selection]));
	if (touched.length > 0) return unwrap(line, touched);
	const target =
		selection.from === selection.to
			? (wordAt(line, selection.from) ?? selection)
			: trimSpan(line, selection);
	return wrap(line, target);
}

function wrap(line: string, span: Span): MarkToggle {
	const text = line.slice(span.from, span.to);
	const inner = span.from + 2;
	return {
		edit: { from: span.from, to: span.to, insert: `{{${text}}}` },
		selection: { from: inner, to: inner + text.length },
	};
}

/** Replace each mark with its visible text: the display text, or the target for a plain mark. */
function unwrap(line: string, marks: readonly MarkRange[]): MarkToggle {
	const from = marks[0]?.from ?? 0;
	const to = marks[marks.length - 1]?.to ?? from;
	let insert = '';
	let pos = from;
	for (const mark of marks) {
		insert += line.slice(pos, mark.from) + mark.display;
		pos = mark.to;
	}
	return { edit: { from, to, insert }, selection: { from, to: from + insert.length } };
}

/** The word around `pos`, or `null` when `pos` touches no word character. */
function wordAt(line: string, pos: number): Span | null {
	let from = pos;
	let to = pos;
	while (from > 0 && WORD_CHAR.test(line[from - 1] ?? '')) from -= 1;
	while (to < line.length && WORD_CHAR.test(line[to] ?? '')) to += 1;
	return from < to ? { from, to } : null;
}

function trimSpan(line: string, { from, to }: Span): Span {
	while (from < to && /\s/u.test(line[from] ?? '')) from += 1;
	while (to > from && /\s/u.test(line[to - 1] ?? '')) to -= 1;
	return { from, to };
}
