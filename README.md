# Keyring

Mark a term inline as `{{term}}`. Hovering it opens a popover with every section in your vault whose heading matches the term, from every note, in one scrollable list.

Keyring suits glossaries, character and place notes, recurring concepts: any term you define under a heading somewhere and want at hand wherever you mention it.

Requires Obsidian 1.13 or later, on desktop.

## Installing

Keyring isn't in Obsidian's community plugin directory yet. Install it from this repository's [releases](https://github.com/materialcontext/obsidian-keyring/releases) with either of these:

**With BRAT (recommended, updates automatically)**

1. In Obsidian, install and enable **BRAT** from Settings → Community plugins.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Enter `materialcontext/obsidian-keyring` and confirm.
4. Enable **Keyring** under Settings → Community plugins.

BRAT checks for new releases and updates Keyring for you.

**Manually**

1. Download `keyring-<version>.zip` from the [latest release](https://github.com/materialcontext/obsidian-keyring/releases/latest).
2. Unzip it into your vault's `.obsidian/plugins/` folder, so you end up with `.obsidian/plugins/keyring/`. The folder is hidden on macOS and Linux; in Obsidian, Settings → Community plugins → the folder icon opens it.
3. Reload Obsidian, then enable **Keyring** under Settings → Community plugins.

To update manually, repeat with the newer zip.

## Usage

Write a mark around a term:

```markdown
The {{Treaty of Westphalia}} ended the war.
The {{Treaty of Westphalia|treaty}} was signed in 1648.
```

- `{{target}}` shows the target as written.
- `{{target|display text}}` shows the display text but looks up the target.

Hover a mark to see every section headed with that target. A **section** is everything under a heading, up to the next heading of the same or higher level (or the end of the note). With the example above, both of these notes would contribute an entry:

```markdown
## Treaty of Westphalia

Signed in Osnabrück and Münster…
```

```markdown
# treaty of westphalia

A series of peace treaties…
```

### Matching

- **Whitespace is ignored:** `{{NewYork}}` matches `## New York`.
- **Capitalization is ignored** by default. Turn on _Case-sensitive matching_ to require it.
- **Markdown inside headings** is matched as written. `## **Bold** term` matches `{{**Bold** term}}`, not `{{Bold term}}`.

### Popovers

- **Ordering:** entries from the note you're in come first, then the rest sorted by path, then by position within each note.
- **Source labels:** each entry is labelled `note › Heading`. Click a label to open the section; Ctrl/Cmd-click opens it in a new tab.
- **Long lists:** the first 20 entries show straight away, and **Show more** loads the rest. Entries render as you scroll to them.
- **Nesting:** marks inside a popover are live, so hovering one opens a nested popover. A term already open in the chain won't open again, so cycles are cut off. Depth is capped by _Maximum nesting depth_.
- **No match:** a mark with no matching heading shows "No sections titled “…”".

### Editing

- **Reading view:** marks show as dotted-underlined text.
- **Live Preview:** `{{`, `target|` and `}}` are hidden. Moving the cursor into a mark reveals its raw text, the same way links behave.
- **Source mode:** marks are underlined and nothing is hidden.

Marks inside code, math, links and frontmatter are ignored.

### Toggle mark command

**Keyring: Toggle mark** adds or removes the braces, the way Ctrl/Cmd-I toggles italics:

- **Text selected:** wraps it as `{{text}}`. Spaces at either end of the selection stay outside.
- **Cursor in a word:** wraps that word.
- **Cursor or selection on a mark:** unwraps it and keeps the visible text. `{{target|display}}` becomes `display`.
- **Anywhere else:** inserts `{{}}` with the cursor between the braces.

It works with multiple cursors, one per line. Marks can't span lines, so a selection across lines is left alone.

**Hotkey.** Keyring doesn't set one by default, so it can't clash with yours. Open Settings → Hotkeys, search for "Toggle mark", click **+** and press your combination (Ctrl/Cmd+Shift+K, say). Obsidian warns you if the combination is already taken.

**Leader key (Vim mode).** Obsidian's hotkeys can't be key sequences. With Vim key bindings and the [Vimrc Support](https://github.com/esm7/obsidian-vimrc-support) plugin, add this to your `.obsidian.vimrc`:

```vim
exmap keyringmark obcommand keyring:toggle-mark
" map, not nmap, so it works in normal and visual mode
map <leader>k :keyringmark<CR>
```

In normal mode, `<leader>k` marks the word under the cursor; in visual mode, the selection.

## Settings

| Setting                 | Default |                                                                                                                                                                                                           |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case-sensitive matching | Off     | Require capitalization to match.                                                                                                                                                                          |
| Hover delay             | 300 ms  | How long to hover before a popover opens (0–5000).                                                                                                                                                        |
| Maximum nesting depth   | 5       | How many popovers can open inside each other (1–20).                                                                                                                                                      |
| Excluded folders        | None    | Add folders with **+**; each row offers folder suggestions. Notes in these folders are not indexed and their marks are not highlighted. Use this for template folders with `{{date}}`-style placeholders. |

Changes save immediately and apply to open notes as soon as you stop typing. All settings appear in Obsidian's settings search.

## Commands

- **Keyring: Toggle mark** adds or removes a mark at the cursor or selection. See [Toggle mark command](#toggle-mark-command).
- **Keyring: Dump index stats** shows how many terms, sections and notes are indexed.
- **Keyring: Log editor syntax nodes** shows the editor's syntax node names at the cursor. Use it to report a place where marks should or shouldn't be detected.

## Limitations

- **Formatting across a mark** isn't supported in Reading view: `{{**bold**}}` splits into several pieces of text and isn't recognized. Put formatting around the mark (`**{{term}}**`) instead.
- **Tables:** inside a Markdown table, `|` separates cells, so the `{{target|display}}` form breaks there, as it does for wikilinks. Use plain `{{target}}` in tables.
- **One line, no nesting:** a mark can't span lines, marks don't nest (in `{{a {{b}} c}}`, only `b` is a mark), and `{{}}` with an empty target is plain text.
- **Repeated headings:** if a note repeats a heading, both entries appear in the popover, but clicking either label opens the first.
- **Special characters:** clicking a label for a heading that contains `#`, `|` or `^` may not jump to it, because those characters have special meaning in Obsidian links.
- **Undocumented editor internals:** Live Preview detects code and math using the editor's syntax node names, which Obsidian doesn't document. If marks show up where they shouldn't, run _Log editor syntax nodes_ there and report what it shows.
- **Desktop only:** popovers open on mouse hover.

## Development

```sh
npm install
npm run dev      # watch build -> main.js
npm run build    # typecheck + production build
npm test         # vitest (core only)
npm run bench    # core timings; see docs/PERFORMANCE.md
npm run lint
npm run format
```

To try a development build in a vault, symlink the repo into the vault's plugin folder, then enable **Keyring** under Settings → Community plugins:

```sh
ln -s "$PWD" /path/to/vault/.obsidian/plugins/keyring
```

With `npm run dev` running, reload Obsidian (or use the Hot Reload plugin) to pick up changes.

## Releasing

Releases are cut from `main` by `.github/workflows/release.yml` whenever a push changes the version in `manifest.json`:

1. In a PR, run `npm version <patch|minor|major> --no-git-tag-version`. This updates `package.json`, `manifest.json` and `versions.json` together. Skip the git tag: the workflow creates it.
2. Merge the PR. The workflow re-runs every check, builds, and publishes a release tagged with the bare version (e.g. `0.2.0`), with `main.js`, `manifest.json` and `styles.css` attached (what BRAT installs from), plus `keyring-<version>.zip` for manual installs.

`node check-version.mjs` (also run in CI) fails if the three files disagree. To retry a failed release, run the workflow by hand from the Actions tab.

## License

[MIT](LICENSE)
