/** A half-open range of offsets, `from` inclusive, `to` exclusive. */
export interface Span {
	readonly from: number;
	readonly to: number;
}

/** A normalized heading or mark target. Only `normalizeKey` produces these. */
export type Key = string & { readonly __brand: 'Key' };

/** A heading as reported by the host. Offsets are UTF-16 indices into the file. */
export interface HeadingInfo {
	readonly text: string;
	readonly level: number;
	readonly startOffset: number;
	readonly endOffset: number;
}

/** The body under one heading, located by offsets only. */
export interface SectionRef {
	readonly path: string;
	readonly heading: string;
	readonly level: number;
	/** End of the heading line. */
	readonly bodyStart: number;
	/** Start of the next heading at the same or higher priority; `null` means end of file. */
	readonly bodyEnd: number | null;
}

/**
 * One `{{target}}` or `{{target|display}}` mark.
 * `from`/`to` span the whole mark including braces; `displayFrom`/`displayTo`
 * span the visible text, so an editor can hide everything else.
 */
export interface MarkRange {
	readonly from: number;
	readonly to: number;
	readonly target: string;
	readonly display: string;
	readonly displayFrom: number;
	readonly displayTo: number;
}
