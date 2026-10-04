import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreDir = join(import.meta.dirname, '../../src/core');
const forbidden = /from\s+['"](obsidian|@codemirror\/[^'"]+|@lezer\/[^'"]+)['"]/;

describe('core purity', () => {
	const files = readdirSync(coreDir).filter((f) => f.endsWith('.ts'));

	it('has modules to check', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files)('%s imports nothing from obsidian or the editor', (file) => {
		const source = readFileSync(join(coreDir, file), 'utf8');
		expect(source).not.toMatch(forbidden);
	});
});
