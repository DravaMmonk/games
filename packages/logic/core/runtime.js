// The logic domain for the checks (games/design/README.md 6.3): its vocabulary, a game's spec from its content (the course,
// its levels in play order, the texts a player reads), the domain's checks, and its play
// hook for blind sessions (play.js). Nothing here draws: the page's side is game.js.

import { vocabulary } from './vocabulary.js'
import { logicWorks, prepareLogicWorks } from './work.js'
import { validate } from './validate.js'
import { play } from './play.js'
import { parse } from './formula.js'
import { parseS, parseSide } from './schematic.js'

// The readers of the vocabulary's languages: why a text cannot be read, or null.
const reads = (parser) => (text) => {
  try {
    parser(text)
    return null
  } catch (error) {
    return error.message
  }
}
const languages = { 'logic/formula': reads(parse), 'logic/side': reads(parseSide), 'logic/condition': reads(parseS) }

// What a part's name may be (vocabulary.js PART): the vocabulary's parts and the parts registered by the game.
const names = (content) => ({ part: new Set([...Object.keys(vocabulary.kinds.primitive), ...Object.keys(content.partDefs?.parts ?? {})]) })

/** A logic game's spec, as the checks read one (../../engine/checks.js). */
function spec(content, works = logicWorks(content)) {
  const logic = works
  return {
    id: content.id,
    title: content.title,
    course: logic.course,
    levels: logic.LEVELS,
    logic,
    blueprints: logic.blueprints,
    syncOwn: logic.syncOwn,
    texts: { chapters: logic.CHAPTERS, ...logic.texts },
  }
}

export default { prepare: prepareLogicWorks, vocabulary, languages, names, spec, validate, play }
