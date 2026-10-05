import { describe, expect, it } from 'vitest';
import { toggleMark } from '../../src/core/markEdit';

/**
 * Apply a toggle to `marked`, where `«…»` marks the selection and `^` a cursor
 * (neither can appear in mark syntax), and return the result the same way.
 */
function run(marked: string): string {
	const cursor = marked.indexOf('^');
	const from = cursor !== -1 ? cursor : marked.indexOf('«');
	const to = cursor !== -1 ? cursor : marked.indexOf('»') - 1;
	const line = marked.replace(/[«»^]/g, '');
	const { edit, selection } = toggleMark(line, { from, to });
	const out = line.slice(0, edit.from) + edit.insert + line.slice(edit.to);
	return selection.from === selection.to
		? `${out.slice(0, selection.from)}^${out.slice(selection.from)}`
		: `${out.slice(0, selection.from)}«${out.slice(selection.from, selection.to)}»${out.slice(selection.to)}`;
}

describe('toggleMark: wrapping', () => {
	it('wraps a selection and keeps the text selected', () => {
		expect(run('see «New York» here')).toBe('see {{«New York»}} here');
	});

	it('leaves surrounding whitespace outside the mark', () => {
		expect(run('see« New York »here')).toBe('see {{«New York»}} here');
	});

	it('wraps the word under the cursor', () => {
		expect(run('see Ap^ple here')).toBe('see {{«Apple»}} here');
		expect(run('see ^Apple here')).toBe('see {{«Apple»}} here');
		expect(run('see Apple^ here')).toBe('see {{«Apple»}} here');
	});

	it('treats letters from any script, digits, apostrophes and hyphens as word characters', () => {
		expect(run('the Kö^nig’s well-known ok')).toBe('the {{«König’s»}} well-known ok');
		expect(run('a well-kn^own term')).toBe('a {{«well-known»}} term');
	});

	it('inserts empty braces with the cursor inside when not on a word', () => {
		expect(run('end. ^')).toBe('end. {{^}}');
		expect(run('^')).toBe('{{^}}');
		expect(run('a ( ^ ) b')).toBe('a ( {{^}} ) b');
	});

	it('inserts empty braces for a whitespace-only selection', () => {
		expect(run('a«   »b')).toBe('a   {{^}}b');
	});
});

describe('toggleMark: unwrapping', () => {
	it('unwraps a mark the cursor is in', () => {
		expect(run('see {{Ap^ple}} here')).toBe('see «Apple» here');
	});

	it('counts the braces and the edges as inside', () => {
		expect(run('see ^{{Apple}} here')).toBe('see «Apple» here');
		expect(run('see {{Apple}}^ here')).toBe('see «Apple» here');
	});

	it('unwraps a mark the selection is exactly', () => {
		expect(run('see «{{Apple}}» here')).toBe('see «Apple» here');
		expect(run('see {{«Apple»}} here')).toBe('see «Apple» here');
	});

	it('keeps the display text of a |display mark', () => {
		expect(run('the {{Treaty of Westphalia|tre^aty}} was')).toBe('the «treaty» was');
	});

	it('unwraps every mark a selection touches, keeping text in between', () => {
		expect(run('«{{a}} and {{b|bee}}» c')).toBe('«a and bee» c');
	});

	it('round-trips: wrap then unwrap restores the line', () => {
		const wrapped = run('see «New York» here');
		expect(run(wrapped)).toBe('see «New York» here');
	});
});
