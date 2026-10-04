// Run with: node --expose-gc (see `npm run bench:memory`).
import { syntheticIndex } from './fixtures';

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with --expose-gc');

for (const files of [10_000, 50_000]) {
	gc();
	const before = process.memoryUsage().heapUsed;
	const index = syntheticIndex(files);
	gc();
	const after = process.memoryUsage().heapUsed;
	const sections = files * 5;
	const mb = (after - before) / 1024 / 1024;
	console.log(
		`${files} files / ${sections} sections: ${mb.toFixed(1)} MB retained, ` +
			`${((after - before) / sections).toFixed(0)} B per section (${index.byKey.size} keys)`,
	);
}
