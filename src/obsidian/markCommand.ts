import { type Editor, type EditorPosition, Notice } from 'obsidian';
import { toggleMark } from '../core/markEdit';
import type { Span } from '../core/types';

/**
 * The "Toggle mark" editor command: wrap or unwrap a mark at each selection,
 * like Ctrl-I for italics. Marks can't span lines, so a multi-line selection
 * changes nothing and says why.
 *
 * Each line gets exactly one change, and the selection is set afterwards.
 * obsidian.d.ts doesn't say whether a transaction's change and selection
 * positions refer to the document before or after its changes; with one
 * change per line, positions on other lines are unaffected either way.
 */
export function toggleMarkInEditor(editor: Editor): void {
	const ranges = editor.listSelections().map(({ anchor, head }) => ordered(anchor, head));
	if (ranges.some(([from, to]) => from.line !== to.line)) {
		new Notice("Marks can't span lines. Select text on a single line.");
		return;
	}

	// A second selection on the same line would edit text the first already
	// changed, so only the first selection on each line is toggled.
	const byLine = new Map<number, Span>();
	for (const [from, to] of ranges) {
		if (!byLine.has(from.line)) byLine.set(from.line, { from: from.ch, to: to.ch });
	}
	const toggles = [...byLine].map(([line, span]) => ({
		line,
		...toggleMark(editor.getLine(line), span),
	}));

	editor.transaction({
		changes: toggles.map(({ line, edit }) => ({
			from: { line, ch: edit.from },
			to: { line, ch: edit.to },
			text: edit.insert,
		})),
	});
	editor.setSelections(
		toggles.map(({ line, selection }) => ({
			anchor: { line, ch: selection.from },
			head: { line, ch: selection.to },
		})),
	);
}

function ordered(a: EditorPosition, b: EditorPosition): [EditorPosition, EditorPosition] {
	return a.line < b.line || (a.line === b.line && a.ch <= b.ch) ? [a, b] : [b, a];
}
