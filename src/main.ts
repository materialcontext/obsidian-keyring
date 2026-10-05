import { Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	type KeyringSettings,
	sanitizeSettings,
	settingsImpact,
} from './core/settings';
import { stats } from './core/termIndex';
import { registerHover } from './obsidian/hover';
import { createIndexer, type Indexer } from './obsidian/indexer';
import { createLivePreview, type LivePreview } from './obsidian/livePreview';
import { markPostProcessor, rerenderReadingViews } from './obsidian/readingView';
import { createSettingsApplier } from './obsidian/settingsApplier';
import { KeyringSettingTab } from './obsidian/settingsTab';

export default class KeyringPlugin extends Plugin {
	override settings: KeyringSettings = DEFAULT_SETTINGS;
	indexer!: Indexer;
	livePreview!: LivePreview;
	private applySettings!: ReturnType<typeof createSettingsApplier>;

	override async onload(): Promise<void> {
		this.settings = sanitizeSettings(await this.loadData());
		const getSettings = () => this.settings;

		this.indexer = createIndexer(this.app, this, getSettings);
		this.registerMarkdownPostProcessor(markPostProcessor(getSettings));
		registerHover(this, this.indexer, getSettings);
		this.livePreview = createLivePreview(getSettings);
		this.registerEditorExtension(this.livePreview.extension);
		this.applySettings = createSettingsApplier(this, {
			reindex: () => this.indexer.rebuild(),
			refreshViews: () => {
				this.livePreview.refresh();
				rerenderReadingViews(this.app);
			},
		});
		this.addSettingTab(
			new KeyringSettingTab(this.app, this, {
				settings: getSettings,
				update: (patch) => this.updateSettings(patch),
			}),
		);

		this.addCommand({
			id: 'dump-index-stats',
			name: 'Dump index stats',
			callback: () => {
				const { keys, files, sections } = stats(this.indexer.current());
				const summary = `${keys} keys, ${sections} sections, ${files} files`;
				console.debug(`[keyring] index: ${summary}`);
				new Notice(`Keyring index: ${summary}`);
			},
		});

		this.addCommand({
			id: 'log-syntax-nodes',
			name: 'Log editor syntax nodes',
			callback: () => {
				const names =
					this.livePreview.describeSyntaxAtCursor()?.join(' < ') ?? 'no open editor';
				console.debug(`[keyring] syntax nodes at cursor: ${names}`);
				new Notice(`Syntax nodes at cursor: ${names}`);
			},
		});
	}

	/** Save a change, then apply whatever it requires (settingsImpact decides, the applier batches). */
	async updateSettings(patch: Partial<KeyringSettings>): Promise<void> {
		const previous = this.settings;
		this.settings = { ...previous, ...patch };
		await this.saveData(this.settings);
		this.applySettings(settingsImpact(previous, this.settings));
	}
}
