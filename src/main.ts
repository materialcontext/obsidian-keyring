import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type KeyringSettings } from './settings';

export default class KeyringPlugin extends Plugin {
	override settings: KeyringSettings = DEFAULT_SETTINGS;

	override async onload(): Promise<void> {
		await this.loadSettings();
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<KeyringSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...saved };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
