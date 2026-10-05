import type { MarkRange } from './types';

export interface Span {
	readonly from: number;
	readonly to: number;
}

/** How an editor shows one mark: the span to style, and the syntax to hide. */
export interface MarkLayout {
	readonly styled: Span;
	readonly hidden: readonly Span[];
}

/**
 * Hide `{{`, `target|` and `}}` only when `hideSyntax` (Live Preview) is on and
 * no selection range touches the mark, the way Obsidian reveals link syntax
 * when the cursor enters a link. Otherwise style the raw mark and hide nothing.
 */
export function layoutMark(
	mark: MarkRange,
	selection: readonly Span[],
	hideSyntax: boolean,
): MarkLayout {
	if (!hideSyntax || isTouched(mark, selection)) {
		return { styled: { from: mark.from, to: mark.to }, hidden: [] };
	}
	return {
		styled: { from: mark.displayFrom, to: mark.displayTo },
		hidden: [
			{ from: mark.from, to: mark.displayFrom },
			{ from: mark.displayTo, to: mark.to },
		],
	};
}

/** A selection range touches a mark when it overlaps it or sits at either edge. */
export function isTouched(mark: Span, selection: readonly Span[]): boolean {
	return selection.some((range) => range.from <= mark.to && range.to >= mark.from);
}
