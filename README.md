# Games

Course puzzle games, published at <https://dravammonk.github.io/games/>.

- `games/` — the kernel (`games/kit`) and each game's content. Start with `games/DESIGN.md`.
- `packages/` — the mechanisms games are built from (`core`, `view`, `kinds` per package).
- `trace-viewer/` — the Vite project that runs, tests and builds them.

```bash
cd trace-viewer && npm ci
npm run dev        # http://localhost:5173/ → the games
npm run studio     # the editor
npm test
```

Pushing to `main` builds the site and publishes it to this repository's `gh-pages` branch.

The source was split out of the study-notes repository, history included.
