import { T as catalogText } from 'kernel/words'
import { displays as ui } from './displays.js'
// A tick game on the circuit base's game (../../shell/circuit-game.js), its levels played tick by tick on the
// domain's screen (ui/screen.js).
//
//   vocabulary.js what content may name; domain.js the checks' side of the domain (npm run check)
//   line.js       the world: the line's rule and the world's node
//   board.js      a board, and a board read from and written as blueprint text
//   wants.js      what a level's outputs (and what it says) must be, tick by tick
//   run.js        a board on the line tick by tick (../../engine/ticks.js), checked tick by tick
//   course.js     content read into levels, play order, the parts the levels build and the course the audit checks
//   play.js       a level and an attempt as a blind player meets them (../../engine/play/)
//   ui/           the board screen and its fixed cards
//   validate.js   every level's reference board and built part (npm run check); tick.test.js the line, the wants
//                 and boards as text (npm test)
//   starter/      the smallest game on the domain (npm run new-game copies it)
import { Activity } from 'lucide-react'
import { definedGame } from 'circuit/view'
import { tickBusWorks } from '../core/work.js'



export const playPresentation = { id: 'tick', icon: Activity, label: catalogText("逐拍") }

/** content (../../engine/content.js): { id, title, topic, lede, concept, eras, levels, glossary }. */
export default (content, works = tickBusWorks(content)) => definedGame(content, works, { ops: {}, kind: playPresentation, screen: ui['tick/screen'], cards: ui['tick/catalog'] })
