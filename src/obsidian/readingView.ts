import { type App, type MarkdownPostProcessor, MarkdownView } from 'obsidian';
import { parseMarks } from '../core/marks';
import { isExcluded, pathRules } from '../core/paths';
import type { MarkRange } from '../core/types';
import { el, MARK_CLASS, MARK_SELECTOR, SOURCE_ATTR, TARGET_ATTR, windowOf } from './dom';

/** Text under these is never scanned. */
const SKIP_SELECTOR = `code, pre, a, .math, ${MARK_SELECTOR}`;

/**
 * Wraps every mark in rendered Markdown in a span the hover controller
 * recognizes. Popover bodies go through `MarkdownRenderer.render`, which runs
 * this too, so marks inside popovers are live with no extra code.
 *
 * A mark split across formatting (`{{**bold**}}`) spans several text nodes
 * and is not recognized. That's a documented limitation.
 */
export function markPostProcessor(
	getSettings: () => { readonly excludedFolders: readonly string[] },
): MarkdownPostProcessor {
	return (el, ctx) => {
		// Most blocks have no marks; skip them before walking the tree.
		if (!el.textContent?.includes('{{')) return;
		if (isExcluded(ctx.sourcePath, pathRules(getSettings().excludedFolders))) return;
		wrapMarks(el, ctx.sourcePath);
	};
}

function wrapMarks(root: HTMLElement, sourcePath: string): void {
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const candidates: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		if (text.data.includes('{{') && !text.parentElement?.closest(SKIP_SELECTOR)) {
			candidates.push(text);
		}
	}
	// Replace after walking: mutating during the walk would confuse the walker.
	for (const text of candidates) {
		const marks = parseMarks(text.data);
		if (marks.length > 0) text.replaceWith(splitAround(doc, text.data, marks, sourcePath));
	}
}

function splitAround(
	doc: Document,
	data: string,
	marks: readonly MarkRange[],
	sourcePath: string,
): DocumentFragment {
	const fragment = windowOf(doc).createFragment();
	let last = 0;
	for (const mark of marks) {
		if (mark.from > last) fragment.append(data.slice(last, mark.from));
		const span = el(doc, 'span', MARK_CLASS, mark.display);
		span.setAttribute(TARGET_ATTR, mark.target);
		span.setAttribute(SOURCE_ATTR, sourcePath);
		fragment.append(span);
		last = mark.to;
	}
	if (last < data.length) fragment.append(data.slice(last));
	return fragment;
}

/** Re-render every open note's Reading view, e.g. after settings change which notes are scanned. */
export function rerenderReadingViews(app: App): void {
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
	});
}
