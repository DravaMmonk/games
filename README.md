# 图灵模拟器 · Turing Simulator

把所有知识地图变成图灵完备风格的游戏 — turn every knowledge map into a Turing Complete–style game. Published at
<https://dravammonk.github.io/games/>.

- `games/` — the kernel (`games/kit`) and each game's content. Start with `games/design/README.md`.
- `packages/` — the mechanisms games are built from (`core`, `view`, `kinds` per package).
- `site/` — the Vite project that runs, tests and builds them.

```bash
cd site && npm ci
npm run dev        # http://localhost:5173/ → the games
npm run studio     # http://127.0.0.1:5274/studio.html → the editor
npm test
```

Pushing to `main` builds the site and publishes it to this repository's `gh-pages` branch.

## License

© 2026 DravaMmonk. The code is open source under the [MIT License](LICENSE); the game content (levels, text,
illustrations) is licensed under [CC BY-NC-SA 4.0](LICENSE-CONTENT). "Turing Complete" belongs to its owners; this
platform borrows its style of play and is not affiliated with it.
