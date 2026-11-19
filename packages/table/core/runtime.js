// The table domain for the checks (games/design/README.md 6.3): its vocabulary, a game's spec from its content (the course,
// its levels in play order and the texts a player reads), the domain's checks, and its play
// hook for blind sessions (play.js). Nothing here draws: the page's side is game.js.

import { tableWorks, prepareTableWorks } from './work.js';
import { validate } from './validate.js';
import { play } from './play.js';
import { builtParts } from 'circuit'

/** A table game's spec, as the checks read one (../../engine/checks.js). */
// What a tray may list (capabilities.json): the parts and ideas parts.json names.
const names = content => ({ part: new Set(Object.keys(builtParts(content.partDefs))) });

function spec(content, works = tableWorks(content)) {
  const table = works;
  return {
    id: content.id,
    title: content.title,
    course: table.course,
    levels: table.LEVELS,
    table,
    blueprints: table.blueprints,
    texts: { chapters: table.CHAPTERS, parts: table.PARTS },
  };
}

export default { prepare: prepareTableWorks, names, spec, validate, play };
