# Step 4 · Copy

Refine the player-facing text and glossary through the operation set, in the language the game is written in (its
translations are another step's work: `translate`). This step changes copy,
not tests, boards or course structure. Read `games/design/README.md` §§1 and 4, the blueprint, levels, glossary, game data
and relevant part descriptions.

Write naturally and accurately for the intended learner. Provide the context, assumptions, terms, goals and support
that each task needs. Explanations and examples may be used when they help understanding. Pass text should capture
the principle and its scope without assuming the player used a particular reference solution. Review terminology,
links and prerequisites; a glossary link is useful reference material, not a substitute for the
reasoning or visual evidence needed to play.

Use `text.set`, `level.patch`, `game.set` and glossary operations through `./op --file <file>`; `--dry-run` previews
changes. `./terminology`, `./check` and `./gate` validate the registry, links and content structure. Review wording
and the choice of links against the handbook. Report limitations or issues owned by earlier steps.
