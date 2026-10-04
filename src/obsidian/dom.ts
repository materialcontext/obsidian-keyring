/** Mark spans, shared by Reading view, Live Preview and the hover controller. */
export const MARK_CLASS = 'keyring-mark';
export const MARK_SELECTOR = `.${MARK_CLASS}`;

/** On each mark: the raw target, and the path of the note the mark is in. */
export const TARGET_ATTR = 'data-keyring-target';
export const SOURCE_ATTR = 'data-keyring-source';

/** On each popover: the chain of keys open from the root popover down to it. */
export const CHAIN_ATTR = 'data-keyring-chain';
export const CHAIN_SELECTOR = `[${CHAIN_ATTR}]`;

/** Create an element in `doc`'s own window, which keeps popout windows correct. */
export function el<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	cls: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	return windowOf(doc).createEl(tag, text === undefined ? { cls } : { cls, text });
}

/** The per-window globals this layer uses. Obsidian installs `createEl` and friends in every window. */
interface WindowGlobals {
	readonly createEl: typeof createEl;
	readonly createFragment: typeof createFragment;
	readonly IntersectionObserver: typeof IntersectionObserver;
}

export const windowOf = (doc: Document): Window & WindowGlobals =>
	doc.win as Window & WindowGlobals;

/** `target.closest`, safe for targets from other windows and for non-element nodes. */
export function closestFrom(target: EventTarget | null, selector: string): HTMLElement | null {
	const element = target as Element | null;
	if (typeof element?.closest !== 'function') return null;
	return element.closest<HTMLElement>(selector);
}
