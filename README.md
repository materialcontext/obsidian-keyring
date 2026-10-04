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

## License

[MIT](LICENSE)
