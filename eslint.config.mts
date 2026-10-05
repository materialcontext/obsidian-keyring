import obsidianmd from 'eslint-plugin-obsidianmd';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'check-version.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// core/ is pure: no Obsidian, no CodeMirror, no reaching back into the adapter layer.
		files: ['src/core/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [{ name: 'obsidian', message: 'core/ must not import obsidian.' }],
					patterns: [
						{
							group: ['@codemirror/*', '@lezer/*'],
							message: 'core/ must not import editor libraries.',
						},
						{
							group: ['**/obsidian/**', '../*'],
							message: 'core/ may only import from core/.',
						},
					],
				},
			],
		},
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: { globals: { ...globals.node } },
	},
	{
		// Benchmarks are Node scripts, not plugin code: they print results and use globalThis.gc.
		files: ['bench/**/*.ts'],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			'obsidianmd/rule-custom-message': 'off',
			'obsidianmd/no-global-this': 'off',
		},
	},
	prettier,
);
