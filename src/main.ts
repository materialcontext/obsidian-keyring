import { Notice, Plugin } from 'obsidian';
import { stats } from './core/termIndex';
import { registerHover } from './obsidian/hover';
import { createIndexer, type Indexer } from './obsidian/indexer';
import { createLivePreview } from './obsidian/livePreview';
import { markPostProcessor } from './obsidian/readingView';
import { DEFAULT_SETTINGS, type KeyringSettings } from './settings';

export default class KeyringPlugin extends Plugin {
	override settings: KeyringSettings = DEFAULT_SETTINGS;
	indexer!: Indexer;

	override async onload(): Promise<void> {
		await this.loadSettings();
		const getSettings = () => this.settings;

		this.indexer = createIndexer(this.app, this, getSettings);
		this.registerMarkdownPostProcessor(markPostProcessor(getSettings));
		registerHover(this, this.indexer, getSettings);
		const livePreview = createLivePreview(getSettings);
		this.registerEditorExtension(livePreview.extension);

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
				const names = livePreview.describeSyntaxAtCursor()?.join(' < ') ?? 'no open editor';
				console.debug(`[keyring] syntax nodes at cursor: ${names}`);
				new Notice(`Syntax nodes at cursor: ${names}`);
			},
		});
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<KeyringSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...saved };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
