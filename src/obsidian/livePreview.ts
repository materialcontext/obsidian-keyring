import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import type { NodeType, SyntaxNode, Tree } from '@lezer/common';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { isTouched, layoutMark } from '../core/markLayout';
import { parseMarks } from '../core/marks';
import { isExcluded, pathRules } from '../core/paths';
import type { MarkRange, Span } from '../core/types';
import { MARK_CLASS, SOURCE_ATTR, TARGET_ATTR } from './dom';

/**
 * Syntax nodes whose text is never scanned, matched by substring because
 * Obsidian's node names are undocumented. Mirrors Reading view's skip list
 * (code, math, links). Verify names with the "Log editor syntax nodes" command.
 */
const SKIP_NODE = /code|math|link|url|comment|frontmatter/i;

const hideSyntax = Decoration.replace({});

/** Forces a rescan, e.g. after the excluded folders change. */
const refreshMarks = StateEffect.define<null>();

interface Scan {
	readonly marks: readonly MarkRange[];
	/** One decoration per target, reused so CodeMirror's equality check is an identity hit. */
	readonly decorationFor: (target: string) => Decoration;
}

export interface LivePreview {
	readonly extension: Extension;
	/** Syntax node names at the cursor of the focused (or last opened) editor, innermost first. */
	describeSyntaxAtCursor(): string[] | null;
	/** Rescan every open editor, e.g. after settings change which notes are scanned. */
	refresh(): void;
}

/**
 * Marks in the editor: styled in Source mode and Live Preview, with `{{`,
 * `target|` and `}}` hidden in Live Preview unless the selection touches the
 * mark. Marks are rescanned only when the document, viewport, syntax tree or
 * file changes; selection-only updates (every cursor move) rebuild
 * decorations from the last scan (docs/PERFORMANCE.md P8).
 */
export function createLivePreview(
	getSettings: () => { readonly excludedFolders: readonly string[] },
): LivePreview {
	const views = new Set<EditorView>();

	const extension = ViewPlugin.define(
		(view) => {
			views.add(view);
			let scan = scanVisible(view, getSettings().excludedFolders);
			let touched = touchedMarks(scan, view.state);
			const plugin = {
				decorations: decorate(view.state, scan),
				update(update: ViewUpdate) {
					const { startState, state } = update;
					const rescan =
						update.docChanged ||
						update.transactions.some((tr) =>
							tr.effects.some((e) => e.is(refreshMarks)),
						) ||
						update.viewportChanged ||
						syntaxTree(startState) !== syntaxTree(state) ||
						filePath(startState) !== filePath(state);
					if (rescan) scan = scanVisible(update.view, getSettings().excludedFolders);

					// Most cursor moves don't enter or leave a mark: keep the decorations
					// and CodeMirror has nothing to diff.
					const nowTouched = touchedMarks(scan, state);
					const modeChanged = isLivePreview(startState) !== isLivePreview(state);
					if (rescan || modeChanged || !sameItems(touched, nowTouched)) {
						plugin.decorations = decorate(state, scan);
					}
					touched = nowTouched;
				},
				destroy() {
					views.delete(view);
				},
			};
			return plugin;
		},
		{ decorations: (plugin) => plugin.decorations },
	);

	return {
		extension,
		describeSyntaxAtCursor() {
			const all = [...views];
			const view = all.find((v) => v.hasFocus) ?? all[all.length - 1];
			if (!view) return null;
			return nodeNames(syntaxTree(view.state), view.state.selection.main.head);
		},
		refresh() {
			for (const view of views) view.dispatch({ effects: refreshMarks.of(null) });
		},
	};
}

function scanVisible(view: EditorView, excludedFolders: readonly string[]): Scan {
	const sourcePath = filePath(view.state);
	const decorations = new Map<string, Decoration>();
	const decorationFor = (target: string): Decoration => {
		let decoration = decorations.get(target);
		if (!decoration) decorations.set(target, (decoration = markDecoration(target, sourcePath)));
		return decoration;
	};
	if (isExcluded(sourcePath, pathRules(excludedFolders))) return { marks: [], decorationFor };

	const { doc } = view.state;
	const tree = syntaxTree(view.state);
	const marks: MarkRange[] = [];
	for (const { from, to } of visibleLines(view)) {
		const skipped = skippedSpans(tree, from, to);
		let next = 0;
		for (const mark of parseMarks(doc.sliceString(from, to), from)) {
			// Both lists are in document order, so one pointer walks the skipped spans.
			while (next < skipped.length && (skipped[next]?.to ?? 0) <= mark.from) next += 1;
			const span = skipped[next];
			if (!span || span.from > mark.from) marks.push(mark);
		}
	}
	return { marks, decorationFor };
}

/** Visible ranges widened to whole lines (marks never span lines) and merged. */
function visibleLines(view: EditorView): Span[] {
	const { doc } = view.state;
	const lines: Span[] = [];
	for (const range of view.visibleRanges) {
		const from = doc.lineAt(range.from).from;
		const to = doc.lineAt(range.to).to;
		const last = lines[lines.length - 1];
		if (last && from <= last.to)
			lines[lines.length - 1] = { from: last.from, to: Math.max(last.to, to) };
		else lines.push({ from, to });
	}
	return lines;
}

function decorate(state: EditorState, { marks, decorationFor }: Scan): DecorationSet {
	const live = isLivePreview(state);
	const selection = state.selection.ranges;
	// Marks are sorted and disjoint, and each layout's spans are in order, so
	// the builder never needs to sort (it throws if that ever stops being true).
	const builder = new RangeSetBuilder<Decoration>();
	for (const mark of marks) {
		const { styled, hidden } = layoutMark(mark, selection, live);
		const [before, after] = hidden;
		if (before) builder.add(before.from, before.to, hideSyntax);
		builder.add(styled.from, styled.to, decorationFor(mark.target));
		if (after) builder.add(after.from, after.to, hideSyntax);
	}
	return builder.finish();
}

/** The marks the selection touches; only these show raw syntax in Live Preview. */
const touchedMarks = ({ marks }: Scan, state: EditorState): readonly MarkRange[] =>
	marks.filter((mark) => isTouched(mark, state.selection.ranges));

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
	a.length === b.length && a.every((item, i) => item === b[i]);

/** Same class and attributes as Reading view, so one hover controller serves both. */
const markDecoration = (target: string, sourcePath: string): Decoration =>
	Decoration.mark({
		class: MARK_CLASS,
		attributes: { [TARGET_ATTR]: target, [SOURCE_ATTR]: sourcePath },
	});

/** Node types are shared objects, so the name test runs once per type, not once per node. */
const skipsType = new WeakMap<NodeType, boolean>();

function skips(type: NodeType): boolean {
	let skip = skipsType.get(type);
	if (skip === undefined) skipsType.set(type, (skip = SKIP_NODE.test(type.name)));
	return skip;
}

/**
 * Spans of skipped nodes overlapping `from..to`, in document order, from one
 * walk of the tree. Looking up each mark with `resolveInner` instead costs a
 * scan of the document's top-level nodes per mark (docs/PERFORMANCE.md).
 */
function skippedSpans(tree: Tree, from: number, to: number): Span[] {
	const spans: Span[] = [];
	tree.iterate({
		from,
		to,
		enter: (node) => {
			if (!skips(node.type)) return undefined;
			spans.push({ from: node.from, to: node.to });
			return false;
		},
	});
	return spans;
}

function nodeNames(tree: Tree, pos: number): string[] {
	const names: string[] = [];
	for (let node: SyntaxNode | null = tree.resolveInner(pos, 1); node; node = node.parent) {
		names.push(node.name);
	}
	return names;
}

const filePath = (state: EditorState): string =>
	state.field(editorInfoField, false)?.file?.path ?? '';

const isLivePreview = (state: EditorState): boolean =>
	state.field(editorLivePreviewField, false) ?? false;
