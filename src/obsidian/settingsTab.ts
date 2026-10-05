import { type App, type Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	HOVER_DELAY_MS,
	type KeyringSettings,
	NESTING_DEPTH,
	rangeError,
} from '../core/settings';

/** What the tab needs from the plugin: the current settings and a way to change them. */
export interface SettingsHost {
	readonly settings: () => KeyringSettings;
	readonly update: (patch: Partial<KeyringSettings>) => Promise<void>;
}

/** List rows bind to `excludedFolders.<index>`; every other key is a settings field. */
const FOLDER_KEY = /^excludedFolders\.(\d+)$/;

/**
 * Declarative settings (Obsidian 1.13+): the framework renders the controls,
 * indexes them for settings search, and runs `validate` before saving.
 */
export class KeyringSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly host: SettingsHost,
	) {
		super(app, plugin);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		const folders = this.host.settings().excludedFolders;
		return [
			{
				name: 'Case-sensitive matching',
				desc: 'Match marks to headings only when capitalization agrees. Whitespace is always ignored.',
				control: { type: 'toggle', key: 'caseSensitive' },
			},
			{
				name: 'Hover delay',
				desc: `Milliseconds before a popover opens (${HOVER_DELAY_MS.min}–${HOVER_DELAY_MS.max}).`,
				control: {
					type: 'number',
					key: 'hoverDelayMs',
					...HOVER_DELAY_MS,
					step: 1,
					validate: (value) => rangeError(value, HOVER_DELAY_MS),
				},
			},
			{
				name: 'Maximum nesting depth',
				desc: `How many popovers can open inside each other (${NESTING_DEPTH.min}–${NESTING_DEPTH.max}).`,
				control: {
					type: 'number',
					key: 'maxNestingDepth',
					...NESTING_DEPTH,
					step: 1,
					validate: (value) => rangeError(value, NESTING_DEPTH),
				},
			},
			{
				type: 'list',
				heading: 'Excluded folders',
				emptyState:
					'No folders excluded. Notes in an excluded folder are not indexed and their marks ' +
					'are not highlighted, which keeps template placeholders like {{date}} quiet.',
				items: folders.map((_, index) => ({
					name: `Excluded folder ${index + 1}`,
					aliases: ['exclude', 'ignore', 'templates'],
					control: {
						type: 'folder',
						key: `excludedFolders.${index}`,
						placeholder: 'Templates',
					},
				})),
				addItem: {
					name: 'Add folder',
					action: () => void this.setFolders([...folders, '']),
				},
				onDelete: (index) => void this.setFolders(folders.filter((_, i) => i !== index)),
			},
		];
	}

	override getControlValue(key: string): unknown {
		const settings = this.host.settings();
		const folder = folderIndex(key);
		if (folder !== null) return settings.excludedFolders[folder] ?? '';
		return isSettingsKey(key) ? settings[key] : undefined;
	}

	override setControlValue(key: string, value: unknown): Promise<void> {
		const folder = folderIndex(key);
		if (folder !== null) {
			const folders = [...this.host.settings().excludedFolders];
			folders[folder] = typeof value === 'string' ? value : '';
			return this.host.update({ excludedFolders: folders });
		}
		return isSettingsKey(key) ? this.host.update({ [key]: value }) : Promise.resolve();
	}

	/** Adding or removing a row changes the definitions themselves, so they're rebuilt. */
	private async setFolders(excludedFolders: string[]): Promise<void> {
		await this.host.update({ excludedFolders });
		this.update();
	}
}

function folderIndex(key: string): number | null {
	const match = FOLDER_KEY.exec(key);
	return match ? Number(match[1]) : null;
}

const isSettingsKey = (key: string): key is keyof KeyringSettings => key in DEFAULT_SETTINGS;
