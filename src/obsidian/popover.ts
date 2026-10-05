import { type App, Keymap, MarkdownRenderer, type HoverPopover } from 'obsidian';
import { basename } from '../core/paths';
import { sectionBody } from '../core/sections';
import type { SectionRef } from '../core/types';
import { el, windowOf } from './dom';

/** Entries rendered per batch; the rest wait behind "Show N more". */
const BATCH = 20;
/** Entries whose bodies render immediately, during the hover delay, before the popover is visible. */
const EAGER = 3;

/**
 * Fill a popover with one block per entry: a clickable source label and the
 * section body, each rendered with its own `sourcePath` so links and embeds
 * resolve relative to the file the section came from.
 */
export function renderPopover(
	app: App,
	popover: HoverPopover,
	entries: readonly SectionRef[],
	target: string,
	sourcePath: string,
): void {
	const doc = popover.hoverEl.ownerDocument;
	const content = el(doc, 'div', 'keyring-popover-content markdown-rendered');
	popover.hoverEl.append(content);

	if (entries.length === 0) {
		content.append(el(doc, 'div', 'keyring-note', `No sections titled “${target}”`));
		return;
	}

	// HoverPopover loads when shown and unloads when hidden (undocumented;
	// matches the native show/hide logic mirrored by Hover Editor). After that,
	// pending renders are dropped.
	let closed = false;
	popover.register(() => (closed = true));

	const lazy = new Map<Element, () => void>();
	const observer = new (windowOf(doc).IntersectionObserver)(
		(records) => {
			for (const record of records) {
				if (!record.isIntersecting) continue;
				observer.unobserve(record.target);
				lazy.get(record.target)?.();
				lazy.delete(record.target);
			}
		},
		// Bodies render just before they scroll into view. Unrendered bodies keep a
		// placeholder height (styles.css) so far entries stay out of range.
		{ root: content, rootMargin: '100px' },
	);
	popover.register(() => observer.disconnect());

	const renderBody = async (entry: SectionRef, body: HTMLElement): Promise<void> => {
		const file = app.vault.getFileByPath(entry.path);
		if (!file) {
			body.append(el(doc, 'div', 'keyring-note', 'File not found.'));
			return;
		}
		const text = sectionBody(await app.vault.cachedRead(file), entry);
		if (closed) return;
		if (text === '') {
			body.append(el(doc, 'div', 'keyring-note', 'Empty section.'));
			return;
		}
		await MarkdownRenderer.render(app, text, body, entry.path, popover);
	};

	const entryBlock = (entry: SectionRef, eager: boolean): HTMLElement => {
		const block = el(doc, 'div', 'keyring-entry');
		const label = el(
			doc,
			'div',
			'keyring-source',
			`${basename(entry.path)} › ${entry.heading}`,
		);
		label.setAttribute('role', 'link');
		label.tabIndex = 0;
		const open = (evt: MouseEvent | KeyboardEvent) =>
			void app.workspace.openLinkText(
				`${entry.path}#${entry.heading}`,
				sourcePath,
				Keymap.isModEvent(evt),
			);
		label.addEventListener('click', open);
		label.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter') open(evt);
		});
		const body = el(doc, 'div', 'keyring-body');
		block.append(label, body);

		const load = () =>
			renderBody(entry, body).catch((error: unknown) => {
				body.append(el(doc, 'div', 'keyring-note', 'Could not load this section.'));
				console.error('[keyring] rendering section failed', error);
			});
		if (eager) void load();
		else {
			lazy.set(body, () => void load());
			observer.observe(body);
		}
		return block;
	};

	const more = el(doc, 'button', 'keyring-more');
	let shown = 0;
	const showBatch = (): void => {
		const batch = entries.slice(shown, shown + BATCH);
		for (const [i, entry] of batch.entries()) {
			content.insertBefore(entryBlock(entry, shown + i < EAGER), more);
		}
		shown += batch.length;
		const remaining = entries.length - shown;
		if (remaining > 0)
			more.textContent = `Show ${Math.min(remaining, BATCH)} more (${remaining} left)`;
		else more.remove();
	};
	more.addEventListener('click', showBatch);
	content.append(more);
	showBatch();
}
