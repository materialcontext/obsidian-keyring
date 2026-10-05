import { applyOps, emptyIndex, type IndexOp, type TermIndex } from '../src/core/termIndex';
import type { SectionRef } from '../src/core/types';

/** A synthetic vault: `files` notes with `perFile` headings each. Every 50th heading is a shared term. */
export function syntheticOps(files: number, perFile = 5): IndexOp[] {
	const ops: IndexOp[] = [];
	for (let f = 0; f < files; f++) {
		const path = `folder ${f % 40}/note ${f}.md`;
		const sections: SectionRef[] = [];
		for (let h = 0; h < perFile; h++) {
			const shared = (f * perFile + h) % 50 === 0;
			sections.push({
				path,
				heading: shared ? `Shared Term ${h}` : `Heading ${f} ${h}`,
				level: 2,
				bodyStart: h * 400,
				bodyEnd: (h + 1) * 400,
			});
		}
		ops.push({ kind: 'set', path, sections });
	}
	return ops;
}

export const syntheticIndex = (files: number, perFile = 5): TermIndex =>
	applyOps(emptyIndex({ caseSensitive: false }), syntheticOps(files, perFile));

/** Prose with a mark roughly every `every` characters (0 = no marks). */
export function prose(length: number, every: number, mark = '{{Shared Term 0|a term}}'): string {
	const word = 'lorem ipsum dolor sit amet consectetur ';
	let out = '';
	let sinceMark = 0;
	while (out.length < length) {
		if (every > 0 && sinceMark >= every) {
			out += `${mark} `;
			sinceMark = 0;
		}
		out += word;
		sinceMark += word.length;
		if (out.length % 400 < word.length) out += '\n';
	}
	return out.slice(0, length);
}
