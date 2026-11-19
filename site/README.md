# site

The games' Vite project: the dev server (`npm run dev`, games at `/game/`), the studio (`npm run studio` at `http://127.0.0.1:5274/studio.html`), the
published build (`npm run build:games` → `dist-games/`), and the kit's tests and tools (`npm test`, `npm run check`,
`npm run op`, …). Every command runs from this folder; the code it builds lives in `../games` and `../packages`.

Studio requires its port to be free. Vite reports a conflict instead of switching ports.

`npm test` exercises the platform and executable package code with synthetic fixtures. `npm run check` verifies that
workspace data and its plugins load. Studio changes and publish checks use the platform checks. Use
`npm run check -- --authoring <game or package>` to review authored examples and course rules.

`src/figures` contains the three interactive figures used in Vision Complete’s level introductions.

Run `npm run figures` to regenerate Boxy, Detach, and Press. `npm run check` verifies those outputs against a fresh build.
