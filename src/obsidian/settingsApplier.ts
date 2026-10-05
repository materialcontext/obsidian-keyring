import { type Component, debounce } from 'obsidian';
import type { SettingsImpact } from '../core/settings';

/** Settings save on every change; the expensive effects wait for typing to pause. */
const APPLY_DELAY_MS = 300;

export interface SettingsEffects {
	readonly reindex: () => void;
	readonly refreshViews: () => void;
}

/**
 * Collects the impact of a burst of settings changes and applies it once, so
 * typing a folder name rebuilds the index once, not per keystroke. Pending
 * work is dropped when `host` unloads.
 */
export function createSettingsApplier(
	host: Component,
	effects: SettingsEffects,
): (impact: SettingsImpact) => void {
	let reindex = false;
	let refreshViews = false;
	const flush = debounce(
		() => {
			// Reindex first so redrawn views see the new index.
			if (reindex) effects.reindex();
			if (refreshViews) effects.refreshViews();
			reindex = refreshViews = false;
		},
		APPLY_DELAY_MS,
		true,
	);
	host.register(() => flush.cancel());

	return (impact) => {
		reindex ||= impact.reindex;
		refreshViews ||= impact.refreshViews;
		if (reindex || refreshViews) flush();
	};
}
