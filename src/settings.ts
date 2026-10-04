export interface KeyringSettings {
	caseSensitive: boolean;
	hoverDelayMs: number;
	maxNestingDepth: number;
	excludedFolders: readonly string[];
}

export const DEFAULT_SETTINGS: KeyringSettings = {
	caseSensitive: false,
	hoverDelayMs: 300,
	maxNestingDepth: 5,
	excludedFolders: [],
};
