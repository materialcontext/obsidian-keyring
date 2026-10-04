import type { HeadingInfo, SectionRef } from './types';

/**
 * One section per heading. A section's body runs from the end of its heading
 * line to the start of the next heading whose level is `<=` its own, or to
 * end of file.
 */
export function sectionsFromHeadings(path: string, headings: readonly HeadingInfo[]): SectionRef[] {
	const sorted = [...headings].sort((a, b) => a.startOffset - b.startOffset);
	const ends: (number | null)[] = sorted.map(() => null);

	// Headings whose section is still open, levels strictly increasing.
	const open: { index: number; level: number }[] = [];
	sorted.forEach((heading, index) => {
		let top = open[open.length - 1];
		while (top && top.level >= heading.level) {
			ends[top.index] = heading.startOffset;
			open.pop();
			top = open[open.length - 1];
		}
		open.push({ index, level: heading.level });
	});

	return sorted.map((heading, i) => ({
		path,
		heading: heading.text,
		level: heading.level,
		bodyStart: heading.endOffset,
		bodyEnd: ends[i] ?? null,
	}));
}

/** The body text of `section` within its file's current `text`. */
export function sectionBody(text: string, section: SectionRef): string {
	return text.slice(section.bodyStart, section.bodyEnd ?? undefined).trim();
}
