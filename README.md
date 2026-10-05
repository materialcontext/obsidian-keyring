# Keyring

Mark a term inline with `{{term}}` or `{{term|display text}}`. Hovering the mark shows every section in your vault whose heading matches `term`, in one scrollable popover.

> Work in progress. See [`docs/SPEC.md`](docs/SPEC.md) for the design and milestones.

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

To try it in a vault, symlink the repo into the vault's plugin folder, then enable **Keyring** under Settings → Community plugins:

```sh
ln -s "$PWD" /path/to/vault/.obsidian/plugins/keyring
```

With `npm run dev` running, reload Obsidian (or use the Hot Reload plugin) to pick up changes.

## Releasing

Releases are cut from `main` by `.github/workflows/release.yml` whenever a push changes the version in `manifest.json`:

1. In a PR, run `npm version <patch|minor|major> --no-git-tag-version`. This updates `package.json`, `manifest.json` and `versions.json` together. Skip the git tag: the workflow creates it.
2. Merge the PR. The workflow re-runs every check, builds, and publishes a release tagged with the bare version (e.g. `0.2.0`), with `main.js`, `manifest.json` and `styles.css` attached.

`node check-version.mjs` (also run in CI) fails if the three files disagree. To retry a failed release, run the workflow by hand from the Actions tab.

## License

[MIT](LICENSE)
