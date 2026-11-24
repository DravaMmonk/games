import declarationsSource from '../capabilities/operation.json' with { type: 'json' }
// The logic domain's engine resources (games/design/README.md 6.8): what a game's parts.json calls, each with what it is and
// its arguments. The proof rules and the lemmas' run are proof.js's, with the options a proof card's settings offer;
// the machine board's parts and the rules a rule part offers are machine.js's.
import { LEMMA, OPTIONS, RULES, lemmaParts } from './proof.js'
import { BACKWARD_POSITIONS, MACHINE_PARTS, REWRITE_CHOICES, RULE_CHOICES } from './machine.js'
import { compileParts, defineParts } from 'circuit'

import { readCopy } from 'kernel/words'

const declarations = readCopy(declarationsSource)

const implementations = { ...RULES, lemma: LEMMA, ...MACHINE_PARTS, ...OPTIONS, ruleChoices: RULE_CHOICES, rewriteOccurrences: REWRITE_CHOICES, backwardPositions: BACKWARD_POSITIONS }

export const OPS = Object.fromEntries(Object.entries(implementations).map(([name, implementation]) => [
  `logic/${name}`, { ...declarations.items[name], ...implementation },
]))

/** A game's parts (../../engine/parts/define.js defineParts): its parts.json's, and those its lemmas make. */
export function partsOf(partDefs, lemmas = {}) {
  const authored = defineParts(partDefs, OPS)
  const generated = compileParts(lemmaParts(lemmas), OPS)
  const PARTS = { ...authored.PARTS, ...generated.PARTS }
  return {
    PARTS,
    defs: { ...authored.defs, ...generated.defs },
    defaultsOf: (type) => ({ ...(PARTS[type]?.defaults ?? {}) }),
  }
}
