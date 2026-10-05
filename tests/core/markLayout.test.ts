import { describe, expect, it } from 'vitest';
import { layoutMark } from '../../src/core/markLayout';
import { parseMarks } from '../../src/core/marks';

const text = 'see {{target|shown}} and {{plain}} here';
const [withDisplay, plain] = parseMarks(text);
const slices = (spans: readonly { from: number; to: number }[]) =>
	spans.map((s) => text.slice(s.from, s.to));
const cursor = (at: number) => [{ from: at, to: at }];

describe('layoutMark', () => {
	it('hides braces and the target prefix when the cursor is elsewhere', () => {
		const layout = layoutMark(withDisplay!, cursor(0), true);
		expect(text.slice(layout.styled.from, layout.styled.to)).toBe('shown');
		expect(slices(layout.hidden)).toEqual(['{{target|', '}}']);
	});

	it('hides only braces for a plain mark', () => {
		const layout = layoutMark(plain!, cursor(0), true);
		expect(text.slice(layout.styled.from, layout.styled.to)).toBe('plain');
		expect(slices(layout.hidden)).toEqual(['{{', '}}']);
	});

	it('shows the raw mark when the cursor is inside or at either edge', () => {
		for (const at of [withDisplay!.from, withDisplay!.from + 5, withDisplay!.to]) {
			const layout = layoutMark(withDisplay!, cursor(at), true);
			expect(layout.hidden).toEqual([]);
			expect(text.slice(layout.styled.from, layout.styled.to)).toBe('{{target|shown}}');
		}
	});

	it('keeps syntax hidden when the cursor is just outside', () => {
		expect(layoutMark(withDisplay!, cursor(withDisplay!.from - 1), true).hidden).toHaveLength(
			2,
		);
		expect(layoutMark(withDisplay!, cursor(withDisplay!.to + 1), true).hidden).toHaveLength(2);
	});

	it('shows the raw mark when any selection range overlaps it', () => {
		const selection = [
			{ from: 0, to: 1 },
			{ from: withDisplay!.to - 3, to: text.length },
		];
		expect(layoutMark(withDisplay!, selection, true).hidden).toEqual([]);
	});

	it('hides nothing in Source mode', () => {
		const layout = layoutMark(withDisplay!, cursor(0), false);
		expect(layout.hidden).toEqual([]);
		expect(layout.styled).toEqual({ from: withDisplay!.from, to: withDisplay!.to });
	});
});
