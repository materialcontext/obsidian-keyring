import type { HeadingInfo, SectionRef } from '../src/core/types';

/** ATX headings with offsets shaped like metadataCache: start of line to end of line. */
export function headingsOf(markdown: string): HeadingInfo[] {
	const headings: HeadingInfo[] = [];
	let offset = 0;
	for (const line of markdown.split('\n')) {
		const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
		if (match?.[1] !== undefined && match[2] !== undefined) {
			headings.push({
				text: match[2],
				level: match[1].length,
				startOffset: offset,
				endOffset: offset + line.length,
			});
		}
		offset += line.length + 1;
	}
	return headings;
}

/** Body text the way the hover controller will read it. */
export const bodyOf = (markdown: string, ref: SectionRef): string =>
	markdown.slice(ref.bodyStart, ref.bodyEnd ?? undefined).trim();

export function section(path: string, heading: string, bodyStart = 0): SectionRef {
	return { path, heading, level: 1, bodyStart, bodyEnd: null };
}
