# site

The games' Vite project: the dev server (`npm run dev`, games at `/game/`), the studio (`npm run studio`), the
published build (`npm run build:games` → `dist-games/`), and the kit's tests and tools (`npm test`, `npm run check`,
`npm run op`, …). Every command runs from this folder; the code it builds lives in `../games` and `../packages`.

`src/figures` contains the three interactive figures used in Vision Complete’s level introductions.

Run `npm run figures` to regenerate Boxy, Detach, and Press. `npm run check` verifies those outputs against a fresh build.
