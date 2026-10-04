import {
	type App,
	type CachedMetadata,
	type Component,
	debounce,
	type HeadingCache,
	type TAbstractFile,
	TFile,
	TFolder,
	Vault,
} from 'obsidian';
import { isIndexable, isUnder, opForRename, pathRules, rebase } from '../core/paths';
import { sectionsFromHeadings } from '../core/sections';
import { applyOps, emptyIndex, type IndexOp, type TermIndex } from '../core/termIndex';
import type { HeadingInfo, SectionRef } from '../core/types';

export interface IndexerSettings {
	readonly caseSensitive: boolean;
	readonly excludedFolders: readonly string[];
}

export interface Indexer {
	/** The index with every pending change applied. */
	current(): TermIndex;
	/** Rebuild from scratch, e.g. after the normalization or exclusion settings change. */
	rebuild(): void;
	/** Called after each change to the index. Returns an unsubscribe function. */
	subscribe(listener: (index: TermIndex) => void): () => void;
}

/** How long vault events are coalesced before the index is updated and listeners notified. */
const FLUSH_DELAY_MS = 100;

/**
 * Owns the single mutable reference to the TermIndex. Vault events become
 * IndexOps that are queued and applied in batches; `current()` applies any
 * pending ops first, so reads are never stale. All listeners are registered on
 * `host`, so they go away when it unloads.
 */
export function createIndexer(
	app: App,
	host: Component,
	getSettings: () => IndexerSettings,
): Indexer {
	let index = emptyIndex({ caseSensitive: getSettings().caseSensitive });
	let rules = pathRules(getSettings().excludedFolders);
	let pending: IndexOp[] = [];
	const listeners = new Set<(index: TermIndex) => void>();

	const commit = (next: TermIndex): void => {
		if (next === index) return;
		index = next;
		for (const listener of listeners) listener(index);
	};

	const flush = (): void => {
		if (pending.length === 0) return;
		const ops = pending;
		pending = [];
		commit(applyOps(index, ops));
	};

	// resetTimer = false: a steady stream of events still flushes every FLUSH_DELAY_MS.
	const scheduleFlush = debounce(flush, FLUSH_DELAY_MS, false);

	// A loop, not push(...ops): a large folder can exceed the argument limit.
	const queue = (ops: readonly IndexOp[]): void => {
		for (const op of ops) pending.push(op);
		scheduleFlush();
	};

	const current = (): TermIndex => {
		flush();
		return index;
	};

	const sectionsAt = (file: TFile): readonly SectionRef[] =>
		sectionsOf(file.path, app.metadataCache.getFileCache(file));

	const rebuild = (): void => {
		const settings = getSettings();
		rules = pathRules(settings.excludedFolders);
		pending = [];
		scheduleFlush.cancel();
		const ops = app.vault
			.getMarkdownFiles()
			.filter((file) => isIndexable(file.path, rules))
			.map((file): IndexOp => ({ kind: 'set', path: file.path, sections: sectionsAt(file) }));
		commit(applyOps(emptyIndex({ caseSensitive: settings.caseSensitive }), ops));
	};

	const onRename = (file: TAbstractFile, oldPath: string): void => {
		// Whether Obsidian also fires per-file events for a folder's contents is
		// undocumented. Handling the folder here is safe either way: a repeated
		// rename or remove of the same path is a no-op.
		const moved: [TFile, string][] =
			file instanceof TFolder
				? filesUnder(file).map((child) => [child, rebase(child.path, file.path, oldPath)])
				: file instanceof TFile
					? [[file, oldPath]]
					: [];
		queue(
			moved.map(([child, from]) =>
				opForRename(from, child.path, rules, () => sectionsAt(child)),
			),
		);
	};

	const onDelete = (file: TAbstractFile): void => {
		const gone =
			file instanceof TFile
				? [file.path]
				: [...current().byPath.keys()].filter((path) => isUnder(path, file.path));
		queue(gone.map((path): IndexOp => ({ kind: 'remove', path })));
	};

	host.register(() => {
		scheduleFlush.cancel();
		listeners.clear();
	});

	app.workspace.onLayoutReady(() => {
		rebuild();
		host.registerEvent(
			app.metadataCache.on('changed', (file, _data, cache) => {
				if (isIndexable(file.path, rules)) {
					queue([
						{ kind: 'set', path: file.path, sections: sectionsOf(file.path, cache) },
					]);
				}
			}),
		);
		host.registerEvent(app.vault.on('rename', onRename));
		host.registerEvent(app.vault.on('delete', onDelete));
	});

	return {
		current,
		rebuild,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

function sectionsOf(path: string, cache: CachedMetadata | null): SectionRef[] {
	return sectionsFromHeadings(path, (cache?.headings ?? []).map(toHeadingInfo));
}

function toHeadingInfo(heading: HeadingCache): HeadingInfo {
	return {
		text: heading.heading,
		level: heading.level,
		startOffset: heading.position.start.offset,
		endOffset: heading.position.end.offset,
	};
}

function filesUnder(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	Vault.recurseChildren(folder, (child) => {
		if (child instanceof TFile) files.push(child);
	});
	return files;
}
