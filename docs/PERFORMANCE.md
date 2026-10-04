# Keyring — performance plan

Status: plan only. Nothing here is implemented yet except the benchmark harness (`npm run bench`, `npm run bench:memory`).

This document explains what limits Keyring's speed and memory use, which limits we can move and which we can't, what we measured, and a phased plan for an overhaul. The overhaul targets resource-strained environments (low-end desktops and laptops, and huge vaults; mobile is not a target) and microsecond-scale response where that is physically possible.

## 1. What "microsecond response" can and cannot mean

Keyring runs as JavaScript on Obsidian's renderer main thread. It shares that thread with Obsidian, CodeMirror and every other plugin. The interactions split into two kinds of work.

**Work we own** is synchronous plugin code: normalizing a target, looking it up, ordering entries, scanning text for marks, updating the index. All of this can run in single-digit microseconds, and most of it already does.

**Work we don't own** sets a floor under anything the user can see:

| Floor                          | Typical size                                            | Why we can't beat it                                                               |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Next frame                     | 16.7 ms at 60 Hz, 8.3 ms at 120 Hz                      | Nothing is visible until the browser lays out and paints.                          |
| Hover delay                    | 300 ms (setting)                                        | Intentional, so marks don't flash while the pointer crosses them.                  |
| `HoverPopover` show timing     | undocumented                                            | Obsidian owns the popover lifecycle (see SPEC §Hover controller).                  |
| `MarkdownRenderer.render`      | ms, grows with content                                  | Obsidian's Markdown parser plus DOM construction.                                  |
| `vault.cachedRead`             | µs when cached, ms from disk                            | Async in every case, so at least one microtask.                                    |
| GC pauses                      | scavenges often 0.1–1 ms, larger collections several ms | V8 decides when they run. We can only allocate less.                               |
| JIT warm-up                    | first calls 10–100× slower                              | Cold code runs in the interpreter until V8 optimizes it.                           |
| `performance.now()` resolution | 100 µs, or 5 µs when cross-origin isolated              | Chromium coarsens timers. It's unverified whether Obsidian's renderer is isolated. |

**So the targets are:**

- **Our own work:** plugin-owned synchronous work per interaction costs microseconds at p99, not just at the median.
- **What the user sees:** visible response arrives within one frame of the moment it's allowed to appear: after the hover delay, or on the keystroke that changes a mark.

A microsecond figure for the full path from pointer to pixels isn't achievable in a browser. Any requirement worded that way needs restating against the split above (see §8, open questions).

## 2. Baseline (measured)

Machine: Intel Xeon @ 2.1 GHz, Node 22 (V8 12.4). Synthetic vault: 5 headings per note, and every 50th heading is a shared term. Reproduce with `npm run bench` and `npm run bench:memory`.

| Path   | Operation                               | Now                                                |
| ------ | --------------------------------------- | -------------------------------------------------- |
| Hover  | `normalizeKey`, short term              | 170 ns                                             |
| Hover  | `lookup` hit / miss, 10k files          | 203 / 167 ns                                       |
| Hover  | `lookup` + `orderEntries`, 20 entries   | 2.2 µs                                             |
| Hover  | `lookup` + `orderEntries`, 1000 entries | **267 µs**                                         |
| Editor | `parseMarks`, 8 KB viewport             | **55 µs**                                          |
| Editor | `parseMarks`, 100 KB                    | **690 µs**                                         |
| Index  | `sectionsFromHeadings`, 200 headings    | 10 µs                                              |
| Index  | one-file edit, 1k / 10k / 50k files     | 0.5 / **6.9 / 50** ms                              |
| Index  | full build, 10k files                   | 50 ms (blocks the main thread)                     |
| Memory | retained per section                    | **~420 B** (21 MB at 50k sections, 100 MB at 250k) |

**Low-end devices.** We haven't measured them yet. Until we do, budget with an _assumed_ 4–10× slowdown compared with the machine above, and treat that range as the first thing to replace with real numbers (§7).

## 3. Problems, ranked

### P1. Every index edit copies the whole map: O(keys)

`applyOps` copies `byKey` and `byPath` once per batch. That keeps the index immutable, but each edit costs time proportional to vault size: 6.9 ms at 10k files and 50 ms at 50k. It also leaves megabytes of garbage per edit, which shows up later as GC pauses. Coalescing (milestone 3) limits this to once per 100 ms flush, but it's still the dominant cost and well outside any microsecond budget.

### P2. Memory: ~420 bytes per section

Each section is a JS object, plus a key string, plus per-key arrays, plus two `Map` entries. That's acceptable at 10k notes (~21 MB at 5 headings per note). At 100k notes it becomes roughly 200 MB, which is a real cost even on desktop. In a real vault part of this is shared with `metadataCache` (the heading strings), but the structural overhead remains.

### P3. V8 `Map` deletes are expensive

This came from measuring P1's fixes. At 10k–50k entries, a `delete` followed by re-inserting the same key costs about **9 µs**, and up to ~40 µs with longer keys. Overwriting a value costs **~40 ns**. Deletes leave tombstones that V8 later rehashes away. Today every edit deletes and re-adds the keys of the changed file. So even an in-place, mutable index measured **300–800 µs** per edit until deletes are avoided.

The exact numbers depend on the V8 version and key shape. Electron's V8 is not Node's, so this must be re-measured inside Obsidian (§7).

### P4. Ordering popular terms at hover time

`orderEntries` sorts on every hover using `localeCompare`. That's fine for 20 entries (2 µs) but costs 267 µs for 1000. `Intl.Collator` was _slower_ in our measurements (546 µs), because V8 has an ASCII fast path for `localeCompare`. The fix is structural, not a faster comparator: keep each key's list **presorted by path** at index time. At hover, just move the current file's entries to the front. Measured: **6 µs at 1000 entries**.

### P5. Mark scanning steps one character at a time

`parseMarks` calls `startsWith` at every index. An `indexOf`-based scanner that caches the next `{{`, `}}` and `\n` positions gives identical results (verified on the fixtures) and is 35–100× faster:

| Input             | Now    | `indexOf` prototype |
| ----------------- | ------ | ------------------- |
| 8 KB viewport     | 55 µs  | **1.5 µs**          |
| 100 KB with marks | 690 µs | 20 µs               |
| 100 KB, no marks  | 675 µs | 6.8 µs              |

The bigger win is structural. Marks can't span lines (SPEC decision), so Live Preview only needs to re-scan the **lines a transaction touched**. One 415-character line takes 2.7 µs with today's scanner, and far less with the new one.

### P6. The startup build blocks the main thread

The full build is linear: 50 ms for 10k files on the benchmark machine. On a slow device, or with a 50k-note vault, that becomes hundreds of milliseconds of frozen UI at startup.

### P8. Live Preview (measured in milestone 5)

Measured in headless Chromium with real CodeMirror 6 and `@codemirror/lang-markdown`, on a deliberately dense page: ~100 marks in 36 visible lines. Plugin time per transaction:

| Update      | First version           | Now                                                |
| ----------- | ----------------------- | -------------------------------------------------- |
| Keystroke   | ~74–93 µs               | **~48 µs** (CodeMirror's own transaction: ~360 µs) |
| Cursor move | ~57 µs total added cost | **~2 µs**                                          |

The fixes, in order of impact:

1. **Syntax checks.** Checking each mark with `resolveInner` scanned the document's ~450 top-level nodes per mark. One `tree.iterate` collecting skipped spans replaced it.
2. **No-op cursor moves.** A cursor move that enters or leaves no mark keeps the old decorations, so CodeMirror has nothing to diff.
3. **A real bug in `parseMarks`.** For a mark without `|display`, the pipe search ran to the end of the text, which is quadratic. Bounding it took 100 KB of plain marks from 210 to 60 µs.
4. **Per-mark costs.** A char-code fast path for ASCII whitespace, and `parseMarks(text, offset)` in place of copying every mark to shift it.

### P7. Smaller costs

- **`normalizeKey`:** 170 ns, of which NFC is about 30%. Memoizing per target string brings a hit down to ~10 ns. Heading keys are already computed only once, at index time.
- **Reading view post-processor:** a `TreeWalker` runs over every rendered block. A cheap `el.textContent.includes('{{')` check first skips nearly all blocks.
- **Popover rendering (milestone 4, not built yet):** this will be the most expensive visible path. It's covered in Phase 1 below so it's designed right the first time.

## 4. Architecture changes for the overhaul

### 4.1 Owned mutation in place of copy-on-write (fixes P1 and P3)

The index stays a plain data structure behind pure functions, but `applyOps` **takes ownership** of the index it's given and mutates it in place. Think of it like Rust's ownership rules: after `applyOps(index, ops)`, the caller must not use the old value. The indexer is already the single owner (SPEC §Architecture). JS is single-threaded and reads are synchronous, so readers can't see a half-applied batch.

- **Change detection:** today's identity check (`next === index`) becomes a `version: number` that increments on every change.
- **Deletes:**
  - A key that loses its last section keeps its slot with an empty posting list. It isn't deleted.
  - When tombstones exceed a fraction of the map, compaction runs in idle time.
  - The same rule applies to `byPath`.
- **Tests:** tests that check inputs aren't mutated switch to an explicit `cloneIndex` helper. The behavioral tests stay unchanged.

This trades away the SPEC's "prefer immutable data" for a manageable, predictable hot path, which the SPEC already ranks higher. The API stays functional; only the aliasing rule changes.

We considered and rejected the alternatives:

- **Persistent map (HAMT, e.g. Immutable.js):** a runtime dependency, O(log₃₂ n) with more allocation per update, and it only pays off when several readers need old snapshots. We have one owner.
- **Copy-on-write shards:** 256 shards measured 340 µs per edit at 50k files. That's better than 50 ms, but still far from microseconds.

### 4.2 Columnar section storage (fixes P2)

Replace the `SectionRef` objects with struct-of-arrays storage:

- **Section fields:** `Int32Array` columns for `bodyStart`, `bodyEnd` (−1 for EOF), `level` and `pathId`. These grow geometrically, and slots are reused through a free list.
- **Interned tables:** paths in a `string[]` with a `Map<string, pathId>`, and keys interned the same way.
- **Posting lists:** a section-id list per key, kept presorted by path (P4).
- **Hover:** materializes `SectionRef` views only for the entries it renders.

The target is **≤ 64 B per section**, about 16 MB at 250k sections. This is the most invasive change. Whether it's needed is decided by the 10k vs 100k comparison (§7).

### 4.3 Time-sliced work (fixes P6)

Add a small scheduler in `obsidian/` that runs queued work in slices of at most 4 ms each, yielding between slices with `setTimeout`. The first build then runs in slices.

While indexing is in progress, a hover shows an "Indexing…" state rather than a wrong "No sections" message. That needs an `indexing` flag on the indexer. Core stays unaware of time.

### 4.4 Hot-path rules for milestones 4 and 5 (P5, P7)

These cost nothing extra if adopted while milestones 4 and 5 are written:

- **Mark scanning:** the `indexOf`-based `parseMarks` (P5).
- **Live Preview:**
  - ~~Re-scan only the lines a transaction touched.~~ Superseded by measurement in milestone 5: with the `indexOf` scanner, re-scanning a whole viewport costs about what hashing its lines for a cache would. Instead, rescan only when the document, viewport, syntax tree or file changes, and on selection-only updates rebuild decorations only if the set of marks the selection touches changed.
  - Keep the work within the visible ranges.
  - Never call `resolveInner` per mark. It scans the document's top-level nodes from the start each time. Collect skipped spans with one `tree.iterate` over the visible lines instead.
- **Reading view:** run the `textContent.includes('{{')` check before walking (P7).
- **Hover:**
  - Do the lookup and start `cachedRead` _during_ the hover delay, so content is ready when the delay ends.
  - Render entries lazily as they scroll into view (`IntersectionObserver`).
  - Cap the first render, e.g. 20 entries plus a "Show N more" control.
- **Memoization:** ~~cache `normalizeKey` results for mark targets~~. Dropped in milestone 4: a hover normalizes one target (~170 ns) at most once per hover delay, so a cache would save nothing measurable. Reconsider for the unresolved-mark stretch goal, which would look up every visible mark on each editor update.
- **Steady state:** don't allocate in per-keystroke code where avoidable.

### 4.5 Considered and rejected

- **WASM:** the SPEC rules it out, and it wouldn't help these paths anyway. Our operations take tens of nanoseconds to a few microseconds, and they work on JS strings. Copying a string into WASM memory and converting UTF-16 to UTF-8 costs more than the lookup itself. WASM pays off for bulk computation over data that already lives in linear memory. Keyring doesn't have that workload.
- **Web Worker for lookups:** lookups must be synchronous. A worker round-trip costs far more than the lookup. A worker _could_ run the initial build, but structured-clone transfer of the result would eat most of the gain. Time slicing is simpler. Revisit only if slicing isn't enough.
- **`SharedArrayBuffer`:** requires cross-origin isolation, which is unverified in Obsidian. Don't depend on it.

## 5. Budgets by environment

These are targets for plugin-owned work, measured at **p99**. The low-end column is the desktop budget after the assumed slowdown in §2, until real measurements replace it. Mobile is not a target.

| Path                                        | Desktop                                   | Low-end desktop  |
| ------------------------------------------- | ----------------------------------------- | ---------------- |
| Hover: lookup + order (≤ 1000 entries)      | ≤ 10 µs                                   | ≤ 100 µs         |
| Hover: content ready once the delay elapses | prefetched; first entry in the next frame | same             |
| Keystroke: mark scan + decorations          | ≤ 50 µs                                   | ≤ 500 µs         |
| Index: one-file edit                        | ≤ 20 µs                                   | ≤ 200 µs         |
| Startup: longest main-thread block          | ≤ 4 ms per slice                          | ≤ 4 ms per slice |
| Memory per section                          | ≤ 64 B (Phase 3)                          | ≤ 64 B (Phase 3) |
| Allocation per keystroke                    | ~0                                        | ~0               |

## 6. Phased plan

**Phase 0 (this PR).** This document, plus the benchmark harness (`bench/`).

**Phase 1 (fold into milestones 4 and 5).** _Milestone 4 delivered the `indexOf` scanner, presorted postings, the Reading view check, prefetch during the hover delay, lazy bodies and the cap. Measured: hover ordering of 1000 entries 267 → 7.7 µs; `parseMarks` 8 KB 55 → 4.7 µs, 100 KB 690 → 56 µs, 100 KB without marks 675 → 2.1 µs. Milestone 5 delivered Live Preview within budget (see P8)._ The §4.4 rules: `indexOf` scanner, line-incremental Live Preview, the Reading view check, hover prefetch, lazy rendering with a cap of ~20 entries plus "Show N more" (accepted), and target memoization. Also presorted postings (P4), a small, contained change to `termIndex`.

- _Exit:_ the hover and keystroke rows of §5 are met on desktop.

**Phase 2 (index overhaul).** Owned mutation with a version counter, tombstones in place of deletes, and idle compaction (§4.1). Time-sliced startup with an indexing state (§4.3).

- _Exit:_ one-file edit ≤ 20 µs at 50k files; no main-thread block > 4 ms during startup.

**Phase 3 (memory, only if the 10k vs 100k comparison shows it's needed).** Columnar storage and interning (§4.2).

- _Exit:_ ≤ 64 B per section in `npm run bench:memory`.

**Phase 4 (only if Phase 2 isn't enough).** Revisit moving the initial build to a worker. Revisit persisting an index snapshot keyed by file mtimes. That carries real staleness risk, and `metadataCache` already persists headings.

## 7. Measurement plan

- **Node benchmarks:** `npm run bench` and `npm run bench:memory` give quick feedback in development. Record before/after numbers in each performance PR.
- **In Obsidian:** add a debug command that runs the same micro-benchmarks inside Electron's V8. Node's V8 differs, and P3 shows version-specific behavior matters.
  - `performance.now()` is coarsened in the renderer, so time batches of thousands of iterations and divide.
- **Low-end simulation:** use DevTools CPU throttling (4×, 6×) inside Obsidian. Confirm on a real low-end laptop.
- **10k vs 100k comparison:** run every path at both vault sizes and report the results side by side, with the ratio between them. A path that scales worse than linearly shows up immediately. Run it at the start of the overhaul as the baseline, and again at the end of each phase.
  - _Node:_ `npm run bench` and `npm run bench:memory` gain 10k and 100k fixtures. Paths: build, one-file edit, lookup, ordering of a popular term, and retained memory.
  - _Obsidian:_ a script generates a synthetic 100k-note vault, ignored by git. Measure startup (performance trace, longest Keyring task), time to a complete index, and heap after a full build, compared with a 10k vault.
- **Percentiles:** report p50 and p99, not just medians. GC and JIT effects only show up in the tail.
- **Startup:** record a performance trace of startup with a large synthetic vault, and confirm no long tasks > 50 ms come from Keyring.
- **CI:** don't gate on timings. Shared runners are too noisy. If gating is wanted later, compare against a baseline run on the same machine, with relative thresholds.

## 8. Decisions and open questions

Decided:

- **Environments:** desktop only. There's no mobile target, so the manifest stays `isDesktopOnly`, and Phase 3 is driven only by vault size.
- **Popover cap:** accepted. Render about 20 entries first, with a "Show N more" control.
- **Vault size:** compare 10k vs 100k notes when the overhaul starts (§7). The result decides whether Phase 3 is needed.

Open:

1. **Which interactions need microseconds?** Is it the plugin's own work per interaction (achievable, §5), or something stricter? Pixels on screen can't be under one frame.
