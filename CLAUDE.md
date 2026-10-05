# Keyring

Obsidian plugin. Design and milestones live in `docs/SPEC.md`. Read it before working. Performance limits, budgets and the overhaul plan live in `docs/PERFORMANCE.md`; follow its hot-path rules (§4.4) in new code.

## Commands

- `npm run build`: typecheck and production bundle
- `npm test`: vitest, core only
- `npm run lint`, `npm run format:check`
- `npm run bench`, `npm run bench:memory`: core timings and retained memory (not gated)

All four must pass before pushing (CI runs them).

Releases publish automatically when a merge to `main` changes the version (see README, Releasing). Never hand-edit versions; use `npm version <patch|minor|major> --no-git-tag-version`.

## Rules

- `src/core/` imports nothing from `obsidian`, `@codemirror/*`, `@lezer/*`, or outside `core/`. ESLint and `tests/core/purity.test.ts` enforce this.
- Dependency direction is one-way: `obsidian/` → `core/`.
- `core/` uses plain functions and immutable data, with no classes unless clearly warranted.
- `main.ts` only handles lifecycle and wiring.
- Verify Obsidian APIs against `node_modules/obsidian/obsidian.d.ts` and flag undocumented behavior in a comment.
- Register every listener and resource through `register*` so unload is clean.
- No new runtime dependencies without asking.
- CSS classes and data attributes are prefixed `keyring-`. Use theme variables only.
- One milestone at a time. Each milestone ships as its own PR.
