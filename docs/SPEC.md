# Keyring — Obsidian plugin spec

Plugin name: **Keyring** (id: `keyring`). CSS classes and data attributes use the `keyring-` prefix in place of `hh-`.

## What it does

The user marks a term inline with `{{term}}`. Hovering the mark, in Reading view or Live Preview, opens a popover. The popover shows every section in the vault whose heading matches `term`, concatenated into one scrollable popover with a source label for each entry.

A **section** is the content under a heading, up to the next heading of equal or higher priority (heading level number `<=` the current one), or to end of file. The heading line itself is not part of the body; the entry's source label replaces it.

## Decisions already made

- **Language:** TypeScript only. No WASM.
- **Mark syntax:** `{{target}}` or `{{target|display text}}`.
  - Target is non-empty.
  - No newlines inside a mark.
  - Marks don't nest.
  - Marks spanning formatting boundaries (`{{**bold**}}`) are not supported in Reading view. Document this limitation; don't engineer around it.
  - Inside a Markdown table, `|` splits cells, so the `{{target|display}}` form breaks there (as with wikilinks). Document it alongside the formatting limitation.
- **Normalization:** a heading and a target match when their normalized keys are equal.
  - Normalizing removes all whitespace.
  - It case-folds by default; case sensitivity is a setting.
  - Headings with Markdown inside them are matched on their raw text as provided by `metadataCache`. No further stripping in v1.
- **Nested popovers:** yes. Marks inside a popover are live and open their own popover.
  - A cycle guard prevents opening a term already open in the current chain.
  - Nesting depth is capped (setting, default 5).
- **Ordering inside a popover:**
  1. Entries from the hovered note's own file first.
  2. Then by file path, ascending (locale compare).
  3. Within a file, by position.
- **No match:** the popover shows a short "No sections titled “X”" message. Stretch goal: style unresolved marks differently, like unresolved links.
- **Excluded folders** (setting): files there are neither indexed nor scanned for marks. This exists mainly so template folders using `{{date}}`-style placeholders don't light up.

## Architecture

The codebase has a functional, Obsidian-free core and a thin adapter layer. Manageability beats domain purity: keep modules small and the dependency direction one-way (`obsidian/` → `core/`, never the reverse).

```
src/
  main.ts              Plugin lifecycle and wiring only. No logic.
  core/                NO imports from 'obsidian'. Pure, unit-tested.
    normalize.ts       normalizeKey(text, {caseSensitive}) -> Key
    marks.ts           parseMarks(text) -> MarkRange[]
    sections.ts        sectionsFromHeadings(path, headings) -> SectionRef[]
    termIndex.ts       Immutable index + pure update functions
    paths.ts           Excluded-folder rules, rename -> IndexOp
    order.ts           compareSections; orderEntries(sorted, currentPath) hoists the current file
    chain.ts           nextChain(parent, key, maxDepth) -> chain | null (cycle guard)
    markLayout.ts      layoutMark(mark, selection, hideSyntax) -> styled + hidden spans
    settings.ts        Settings type, defaults, sanitizeSettings, input parsers, settingsImpact
    types.ts           Shared core types
  obsidian/
    indexer.ts         Builds/maintains TermIndex from metadataCache + vault events
    readingView.ts     MarkdownPostProcessor that wraps marks in spans
    livePreview.ts     CM6 ViewPlugin: mark decorations + brace hiding
    hover.ts           Single hover controller
    popover.ts         Popover content: entries, cap, lazy bodies
    dom.ts             Shared class/attribute names, DOM helpers
    settingsTab.ts     PluginSettingTab via getSettingDefinitions() (Obsidian 1.13+)
    settingsApplier.ts Batches the reindex/refresh a settings change needs
styles.css
tests/                 vitest, core only
```

### Core types (shape, not gospel)

```ts
type Key = string & { readonly __brand: 'Key' };

interface HeadingInfo { text: string; level: number; startOffset: number; endOffset: number }
interface SectionRef {
  path: string; heading: string; level: number;
  bodyStart: number;          // heading line end offset
  bodyEnd: number | null;     // next qualifying heading start, null = EOF
}
interface MarkRange {
  from: number; to: number;   // whole mark, braces included
  target: string; display: string;
  displayFrom: number; displayTo: number;  // visible text; Live Preview hides the rest
}
```

`TermIndex` holds its `NormalizeOptions` (so `lookup(index, target)` and updates normalize identically) and two maps:

- `Map<Key, SectionRef[]>` for lookups.
- `Map<path, Key[]>` so a single file can be removed or replaced cheaply.

Index updates are pure functions: `withFile(index, path, sections)`, `withoutFile(index, path)` and `renamed(index, oldPath, newPath)`, each returning a new index. The indexer owns the single mutable reference.

Updates are also data: `IndexOp` is `set | remove | rename`, and `applyOps(index, ops)` applies a batch with at most one copy of the maps. The three functions above are one-op wrappers. The indexer queues ops from vault events and flushes them on a 100 ms debounce, and `current()` flushes first so reads are never stale. Without batching, building 10k files one at a time took ~47 s (each update copies the map); batched it takes ~75 ms.

The index stores offsets only. Section text is read lazily at hover time via `vault.cachedRead(file).slice(bodyStart, bodyEnd ?? undefined).trim()`. The initial build needs no file reads, since `metadataCache` headings are enough.

### Obsidian layer

**Indexer**
- Build on `workspace.onLayoutReady`, from `metadataCache.getFileCache(f)?.headings` for every `vault.getMarkdownFiles()` not in an excluded folder.
- Keep it current with:
  - `metadataCache.on('changed')` → replace that file's entries.
  - `vault.on('delete')` → remove the file.
  - `vault.on('rename')` → apply `renamed`.
- Register every listener through `this.registerEvent` so it unloads cleanly.
- Expose a tiny subscribe/notify so views can refresh when the index changes; the unresolved-mark styling stretch goal needs this.

**Reading view**
- `registerMarkdownPostProcessor`.
- Walk text nodes with a `TreeWalker`, skipping anything inside `code`, `pre`, `a`, `.math`, or an existing mark span.
- Run `parseMarks` on each text node and split it into text plus mark spans.
- Each mark becomes `<span class="keyring-mark" data-keyring-target="…" data-keyring-source="ctx.sourcePath">display</span>`.
- Because popover content is rendered with `MarkdownRenderer.render`, this same post-processor makes marks inside popovers live. That is how nested popovers work, with no extra code.

**Live Preview**
- A CM6 `ViewPlugin` computes decorations over `view.visibleRanges`, using `syntaxTree` to skip code and math nodes.
- Node names in Obsidian's grammar are not documented. Log them at runtime and skip names containing `code` or `math`, then tighten. Implemented as a substring match on `code|math|link|url|comment|frontmatter`, which mirrors Reading view's skip list. The "Log editor syntax nodes" command prints the node names at the cursor.
- Each mark gets `Decoration.mark` with the same class and `data-` attributes as Reading view. Get the source path from `view.state.field(editorInfoField).file`.
- When the selection does not touch a mark, hide the `{{`, `}}` and the `target|` prefix with `Decoration.replace`, the same way Obsidian hides link syntax. When the cursor is inside, show the raw text.
- Only hide syntax when `editorLivePreviewField` is true. In Source mode, mark the text but hide nothing.
- Recompute on `docChanged`, `viewportChanged` and `selectionSet`, plus syntax-tree, file and Live Preview/Source mode changes. Marks are rescanned only for document, viewport, tree or file changes. A selection change rebuilds decorations only when the set of marks the selection touches changed (see `docs/PERFORMANCE.md` P8).

**Hover controller**
- A single delegated `mouseover` handler, registered with `registerDomEvent` on each window's document (main window, plus `window-open` for popouts), catches `.keyring-mark` from both modes and from inside popovers. There is no per-element wiring. No `mouseout` handler is needed: `HoverPopover` attaches its own listeners to the target element.
- It uses `HoverPopover` from `obsidian`. This API is only partly documented, so **check the actual signatures in `node_modules/obsidian/obsidian.d.ts`** before relying on anything. Each popover gets its own `HoverParent` object so nesting works.
- Hover delay is a setting (default 300 ms). It is passed as `HoverPopover`'s `waitTime`. The popover is created on `mouseover` and its content renders during the delay, so it's ready when the popover shows.
- Popover content contains one block per entry:
  - A clickable source label: `basename › Heading`. Clicking it opens the file at that heading via `workspace.openLinkText(path + '#' + heading, sourcePath)`.
  - The body, rendered with `MarkdownRenderer.render(app, body, el, entry.path, popover)`. **Render each entry separately, with its own `sourcePath`**, so relative links and embeds resolve correctly. Never concatenate the markdown first.
- Cycle guard: each popover carries its chain of open keys in a `data-keyring-chain` attribute. A hovered mark reads the chain from its closest enclosing popover (none means a root popover) and `nextChain` refuses a key already in the chain or a chain already at max depth. Keeping the chain in the DOM means no bookkeeping when popovers close; that matters because a popover cancelled before it shows never loads or unloads.
- Entries: the first 20 render, plus a "Show N more" control. The first 3 bodies render eagerly during the hover delay; the rest render as they scroll into view.
- Styling: CSS gives the popover a `max-height` with overflow scroll, a separator between entries, and a subtle dotted underline on `.keyring-mark`. Use theme variables only.

## Settings

| Setting | Default | Range |
|---|---|---|
| Case-sensitive matching | off | |
| Hover delay (ms) | 300 | 0–5000 |
| Max nesting depth | 5 | 1–20 |
| Excluded folders (list) | empty | one per line |

- **Minimum version:** `minAppVersion` is **1.13.0**, for the declarative settings API. Raised from 1.5.0 before the first release.
- **The tab** (`getSettingDefinitions()`): a toggle, two `number` controls, and excluded folders as a `list` of `folder` controls with add and delete.
  - Each folder row binds to the key `excludedFolders.<index>` through `getControlValue`/`setControlValue`.
  - The framework renders the controls, indexes them for settings search, and shows `validate` errors inline. `rangeError` supplies the messages, and a rejected value isn't saved.
- **Loading:** `sanitizeSettings` validates settings read from disk field by field. An invalid field falls back to its default.
- **Applying changes:** every change saves immediately. `settingsImpact` decides what the change needs, and `settingsApplier` runs it once, 300 ms after the last change, so typing a folder name rebuilds once.
  - Case sensitivity rebuilds the index.
  - Excluded folders rebuild the index, rescan open editors (a CodeMirror state effect) and re-render Reading views. Folder lists are compared after normalization, so an empty row or a trailing slash changes nothing.
  - Delay and depth are read live.

## Milestones

Work one milestone at a time. Stop at the end of each for review.

1. **Scaffold.**
   - Start from the official `obsidian-sample-plugin` layout (esbuild).
   - Add vitest and a strict `tsconfig`.
   - Create empty modules matching the tree above.
   - *Done when:* `npm run build` and `npm test` pass, and the plugin loads in a dev vault.
2. **Core.**
   - Implement `normalize`, `marks`, `sections`, `termIndex` and `order`, with thorough tests:
     - Section boundaries across mixed heading levels.
     - The last section running to EOF.
     - Duplicate headings in the same file.
     - The `|display` form.
     - Adjacent marks, unclosed `{{`, and empty targets.
     - Whitespace/case normalization.
     - Rename and remove behavior.
   - *Done when:* tests are green and `core/` has zero `obsidian` imports.
3. **Indexer.**
   - Wire the index to vault events.
   - Add a debug command, "Dump index stats" (shown as "Keyring: Dump index stats"), that prints key and file counts to the console.
   - *Done when:* editing, renaming and deleting notes updates the stats correctly.
4. **Reading view + popover.**
   - Implement the post-processor, hover controller and popover rendering, including nested popovers and the cycle guard.
   - *Done when:* hovering a mark in Reading view shows all matching sections in the correct order, with working source labels.
5. **Live Preview.**
   - Implement the CM6 extension.
   - *Done when:* marks highlight and hover in Live Preview, braces hide when the cursor is outside, and marks in code are ignored.
6. **Settings + polish.**
   - Add the settings tab, excluded folders, and the no-match message.
   - Write a README covering the syntax and its limitations.
7. **Final review.**
   - Review the whole codebase for stylistic and architectural consistency:
     - naming, module boundaries and the one-way `obsidian/` → `core/` direction
     - comment density, error handling and DOM/API usage, which should match across modules
     - docs (`SPEC.md`, `PERFORMANCE.md`, README, `CLAUDE.md`) agreeing with the code
   - Hunt for dead code: unused exports, helpers, settings, CSS classes and stale comments.
   - Hunt for bugs, including edge cases the tests don't cover.
   - *Done when:* every finding is fixed or recorded with a reason, and build, tests, lint and format all pass.

**Stretch (only if asked):**
- Unresolved-mark styling.
- A mobile tap-to-open fallback.
- An autocomplete for `{{` that suggests indexed headings (`EditorSuggest`).
- Excluding the section that contains the hovered mark from its own popover.

## Working agreements

- Performance limits, budgets and the overhaul plan: see `docs/PERFORMANCE.md`.

- Keep `core/` pure and free of `obsidian` imports. If logic is creeping into `obsidian/`, extract it.
- Use small modules and plain functions, and prefer immutable data. No classes in `core/` unless clearly warranted.
- No new runtime dependencies without asking.
- Verify Obsidian API details against the installed `obsidian.d.ts` rather than memory. Flag anything that relies on undocumented behavior.
- Clean up everything on unload through `register*` helpers.
- The user edits in neovim, so don't rely on editor-specific config. Standard `tsconfig`, eslint and prettier are fine.
