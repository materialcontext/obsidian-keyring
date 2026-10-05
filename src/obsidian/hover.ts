import { type App, HoverPopover, type HoverParent, type Plugin } from 'obsidian';
import { decodeChain, encodeChain, nextChain } from '../core/chain';
import { normalizeKey } from '../core/normalize';
import { orderEntries } from '../core/order';
import { lookup } from '../core/termIndex';
import {
	CHAIN_ATTR,
	CHAIN_SELECTOR,
	closestFrom,
	MARK_SELECTOR,
	SOURCE_ATTR,
	TARGET_ATTR,
} from './dom';
import type { Indexer } from './indexer';
import { renderPopover } from './popover';

export interface HoverSettings {
	readonly hoverDelayMs: number;
	readonly maxNestingDepth: number;
}

interface OpenPopover {
	readonly popover: HoverPopover;
	readonly createdAt: number;
}

/**
 * One delegated `mouseover` listener per window catches marks in Reading
 * view, Live Preview and inside popovers. HoverPopover attaches its own
 * mouse listeners to the target, so leaving a mark needs no handler here.
 */
export function registerHover(
	plugin: Plugin,
	indexer: Indexer,
	getSettings: () => HoverSettings,
): void {
	const onMouseOver = createHoverHandler(plugin.app, indexer, getSettings);
	plugin.registerDomEvent(document, 'mouseover', onMouseOver);
	plugin.registerEvent(
		plugin.app.workspace.on('window-open', (_workspaceWindow, win) =>
			plugin.registerDomEvent(win.document, 'mouseover', onMouseOver),
		),
	);
}

function createHoverHandler(
	app: App,
	indexer: Indexer,
	getSettings: () => HoverSettings,
): (evt: MouseEvent) => void {
	const open = new WeakMap<HTMLElement, OpenPopover>();

	// Open = shown, or created within the hover delay and still waiting to show.
	// A popover cancelled before showing never loads or unloads, so its
	// lifecycle can't be observed; the time window covers that case.
	const isOpen = (mark: HTMLElement, delayMs: number): boolean => {
		const existing = open.get(mark);
		return (
			existing !== undefined &&
			(existing.popover.hoverEl.isConnected ||
				performance.now() - existing.createdAt < delayMs)
		);
	};

	return (evt) => {
		const mark = closestFrom(evt.target, MARK_SELECTOR);
		const target = mark?.getAttribute(TARGET_ATTR);
		if (!mark || !target) return;

		const settings = getSettings();
		if (isOpen(mark, settings.hoverDelayMs)) return;

		const index = indexer.current();
		// The chain lives on the enclosing popover's element, so it needs no
		// cleanup when popovers close.
		const parentChain = decodeChain(
			closestFrom(mark, CHAIN_SELECTOR)?.getAttribute(CHAIN_ATTR) ?? undefined,
		);
		const chain = nextChain(
			parentChain,
			normalizeKey(target, index.options),
			settings.maxNestingDepth,
		);
		if (!chain) return;

		const sourcePath = mark.getAttribute(SOURCE_ATTR) ?? '';
		// Each popover gets its own parent: a new popover replaces the one its
		// parent already holds, so sharing a parent would close the outer popover.
		const parent: HoverParent = { hoverPopover: null };
		const popover = new HoverPopover(parent, mark, settings.hoverDelayMs);
		popover.hoverEl.classList.add('keyring-popover');
		popover.hoverEl.setAttribute(CHAIN_ATTR, encodeChain(chain));
		open.set(mark, { popover, createdAt: performance.now() });

		renderPopover(
			app,
			popover,
			orderEntries(lookup(index, target), sourcePath),
			target,
			sourcePath,
		);
	};
}
