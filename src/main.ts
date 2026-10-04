import { Notice, Plugin } from 'obsidian';
import { stats } from './core/termIndex';
import { createIndexer, type Indexer } from './obsidian/indexer';
import { DEFAULT_SETTINGS, type KeyringSettings } from './settings';

export default class KeyringPlugin extends Plugin {
	override settings: KeyringSettings = DEFAULT_SETTINGS;
	indexer!: Indexer;

	override async onload(): Promise<void> {
		await this.loadSettings();
		this.indexer = createIndexer(this.app, this, () => this.settings);

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
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<KeyringSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...saved };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
