import {
	type App,
	debounce,
	type Plugin,
	PluginSettingTab,
	Setting,
	type TextComponent,
} from 'obsidian';
import {
	formatFolderList,
	HOVER_DELAY_MS,
	type IntRange,
	type KeyringSettings,
	NESTING_DEPTH,
	parseBoundedInt,
	parseFolderList,
} from '../core/settings';

/** What the tab needs from the plugin: the current settings and a way to change them. */
export interface SettingsHost {
	readonly settings: () => KeyringSettings;
	readonly update: (patch: Partial<KeyringSettings>) => Promise<void>;
}

/** How long typing in the folder list pauses before it applies (applying rebuilds the index). */
const FOLDER_INPUT_DELAY_MS = 500;

// The declarative getSettingDefinitions() API (settings search) needs Obsidian
// 1.13; minAppVersion is 1.5.0, so the tab builds its UI in display(). The
// linter warns about this; revisit when minAppVersion reaches 1.13.
export class KeyringSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly host: SettingsHost,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl, host } = this;
		const settings = host.settings();
		containerEl.empty();

		new Setting(containerEl)
			.setName('Case-sensitive matching')
			.setDesc(
				'Match marks to headings only when capitalization agrees. Whitespace is always ignored.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.caseSensitive)
					.onChange((caseSensitive) => void host.update({ caseSensitive })),
			);

		new Setting(containerEl)
			.setName('Hover delay')
			.setDesc(
				`Milliseconds before a popover opens (${HOVER_DELAY_MS.min}–${HOVER_DELAY_MS.max}).`,
			)
			.addText((text) =>
				numberField(text, settings.hoverDelayMs, HOVER_DELAY_MS, (hoverDelayMs) =>
					host.update({ hoverDelayMs }),
				),
			);

		new Setting(containerEl)
			.setName('Maximum nesting depth')
			.setDesc(
				`How many popovers can open inside each other (${NESTING_DEPTH.min}–${NESTING_DEPTH.max}).`,
			)
			.addText((text) =>
				numberField(text, settings.maxNestingDepth, NESTING_DEPTH, (maxNestingDepth) =>
					host.update({ maxNestingDepth }),
				),
			);

		const applyFolders = debounce(
			(value: string) => void host.update({ excludedFolders: parseFolderList(value) }),
			FOLDER_INPUT_DELAY_MS,
			true,
		);
		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc(
				'One folder per line. Notes in these folders are not indexed and their marks are not ' +
					'highlighted, which keeps template placeholders like {{date}} quiet.',
			)
			.addTextArea((area) =>
				area
					.setPlaceholder('Templates')
					.setValue(formatFolderList(settings.excludedFolders))
					.onChange(applyFolders),
			);
	}
}

/** A text field that saves only whole numbers within `range`, and marks anything else invalid. */
function numberField(
	text: TextComponent,
	value: number,
	range: IntRange,
	save: (value: number) => Promise<void>,
): void {
	text.inputEl.type = 'number';
	text.inputEl.min = String(range.min);
	text.inputEl.max = String(range.max);
	text.setValue(String(value)).onChange((input) => {
		const parsed = parseBoundedInt(input, range);
		text.inputEl.classList.toggle('keyring-invalid', parsed === null);
		if (parsed !== null) void save(parsed);
	});
}
