# Step 2 · Domain (engineer)

An engineer or engineering agent handles mechanism code and public declarations in the owning `packages/<package>/`.
Shared platform changes belong in `games/kit/`.

## Input

The blueprint's `requests` with `status: 'open'`, and its `mechanisms`. A new topic's domain starts from the scaffold
(`npm run new -- package <name> --kind feature --empty`, games/design/README.md 6.3) before this step.

## Do

For each open request, use the shared [package contracts](../../../design/engine-package-boundaries.md) and the owning
package's declarations. Add the required capability, schema, behavior, view and contract coverage. Then set
the request's status through the operation set (`blueprint.set`): `done`, or `declined` with a `note` saying why and
what the course does instead (the blueprint changes to match, and its gate stays clean).

Read `games/design/README.md` §4.3 and inspect the current domain behavior before resolving a request. For non-assembly
interactions, specify named referents, quantities, units, coordinate conventions, a controlled intervention and
observable feedback. Separate discovery evidence from withheld assessment results: a clue must not depend on a ray,
measurement or comparison hidden at that moment. Stable scales and explicit schematics must preserve the intended
geometric reasoning. A working model is not visual acceptance; desktop/phone labels, contrast and interaction need
screenshots and actual inspection. Record missing capabilities as open domain work instead of treating explanatory
copy as an implementation.

Content stays data: nothing in this step writes a level.

## Gate

`npm run pipeline -- <game> gate domain`: no request open, the domain contract holds for the domain and the game
(`kit/engine/contract.js`), the game passes `npm run check`, and the domain's unit tests pass.
