/** Minimal benchmark runner: calibrates iterations to ~`targetMs`, reports the median of `rounds`. */
export interface Result {
	readonly name: string;
	readonly nsPerOp: number;
}

let sink: unknown;

export function measure(name: string, fn: () => unknown, targetMs = 100, rounds = 7): Result {
	let iterations = 1;
	for (;;) {
		const start = performance.now();
		for (let i = 0; i < iterations; i++) sink = fn();
		if (performance.now() - start >= targetMs / 10 || iterations >= 1 << 26) break;
		iterations *= 2;
	}
	iterations = Math.max(1, Math.round(iterations * 10));
	const samples: number[] = [];
	for (let r = 0; r < rounds; r++) {
		const start = performance.now();
		for (let i = 0; i < iterations; i++) sink = fn();
		samples.push(((performance.now() - start) * 1e6) / iterations);
	}
	samples.sort((a, b) => a - b);
	const result = { name, nsPerOp: samples[Math.floor(rounds / 2)] ?? NaN };
	console.log(`${format(result.nsPerOp).padStart(10)}  ${name}`);
	return result;
}

export const keepAlive = (): unknown => sink;

function format(ns: number): string {
	if (ns < 1_000) return `${ns.toFixed(0)} ns`;
	if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)} µs`;
	return `${(ns / 1_000_000).toFixed(1)} ms`;
}
