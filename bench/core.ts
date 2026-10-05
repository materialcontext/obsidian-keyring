// Baseline timings for every core hot path. Run with `npm run bench`.
import { parseMarks } from '../src/core/marks';
import { normalizeKey } from '../src/core/normalize';
import { orderEntries } from '../src/core/order';
import { sectionsFromHeadings } from '../src/core/sections';
import { applyOps, emptyIndex, lookup, withFile } from '../src/core/termIndex';
import type { HeadingInfo } from '../src/core/types';
import { prose, syntheticIndex, syntheticOps } from './fixtures';
import { measure } from './measure';

const folded = { caseSensitive: false };
const section = (title: string) => console.log(`\n${title}`);

section('Hover path (per hover)');
{
	const index = syntheticIndex(10_000);
	measure('normalizeKey, short term', () => normalizeKey('Shared Term 0', folded));
	measure('lookup hit, 10k-file index', () => lookup(index, 'Shared Term 0'));
	measure('lookup miss, 10k-file index', () => lookup(index, 'nothing here'));
	const hits = lookup(index, 'Shared Term 0').length;
	measure(`lookup + orderEntries, ${hits} entries`, () =>
		orderEntries(lookup(index, 'Shared Term 0'), 'folder 3/note 3.md'),
	);
}

section('Editor path (per keystroke / scroll)');
{
	const viewport = prose(8_000, 300);
	const bigWithMarks = prose(100_000, 300);
	const bigNoMarks = prose(100_000, 0);
	measure(`parseMarks, 8 KB viewport (${parseMarks(viewport).length} marks)`, () =>
		parseMarks(viewport),
	);
	measure(`parseMarks, 100 KB (${parseMarks(bigWithMarks).length} marks)`, () =>
		parseMarks(bigWithMarks),
	);
	measure('parseMarks, 100 KB, no marks', () => parseMarks(bigNoMarks));
	const plainMarks = prose(100_000, 300, '{{Shared Term 0}}');
	measure(`parseMarks, 100 KB (${parseMarks(plainMarks).length} marks without |display)`, () =>
		parseMarks(plainMarks),
	);
}

section('Index maintenance (per metadata change)');
{
	const headings: HeadingInfo[] = Array.from({ length: 200 }, (_, i) => ({
		text: `Heading ${i}`,
		level: (i % 4) + 1,
		startOffset: i * 300,
		endOffset: i * 300 + 20,
	}));
	measure('sectionsFromHeadings, 200 headings', () => sectionsFromHeadings('note.md', headings));
	const [edit] = syntheticOps(1);
	const sections = edit?.kind === 'set' ? edit.sections : [];
	for (const files of [1_000, 10_000, 50_000]) {
		const index = syntheticIndex(files);
		measure(`one-file edit, ${files.toLocaleString('en')} files`, () =>
			withFile(index, 'folder 0/note 0.md', sections),
		);
	}
	const ops = syntheticOps(10_000);
	measure('full build, 10k files', () => applyOps(emptyIndex(folded), ops), 500, 3);
}
