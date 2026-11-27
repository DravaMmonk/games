// A proof level (《证明完毕》, ../proof.js) as the circuit package plays it: its
// premises down the left, the goal on the right, the rules and the lemmas as parts (a game's parts.json, the lemmas
// registered by the course), a box's regions on the same board. Each test provides the premises and goal.
// A card holds the schema's letters and shows them as the test's
// sentences: its sentences are built in the language of the level's own (choices.js), its choices worked out by the
// domain's resources on the test on view.
import { T } from 'kernel/words'
import { TreeButton } from 'sentence/view'
import { parse, replaceAtoms } from '../../core/formula.js'
import { choicesOf } from '../../core/choices.js'
import { vocabulary } from '../../core/fol.js'
import { sentencePicker } from '../../core/sentenceLanguage.js'
import { scriptLines } from '../../core/script.js'
import { runProof, withSoleInstances } from '../../core/proof.js'
import { bindsThing, followNames, reservedIn } from '../../core/names.js'
import { proofMarkedTextOf, proofReadout, proofTextOf as textOf } from '../../core/circuit-readouts.js'
import { Formula, typesetOne } from './Formula.jsx'
import OccurrenceChoice from './OccurrenceChoice.jsx'

/** The language a card's sentence is built in: the parts of the level's sentences, each letter read as the test's. */
function language(task, test) {
  const offer = choicesOf(task)
  const consts = task.consts ?? []
  const text = textOf(task, test)
  const arity = new Map(vocabulary(offer.formula).preds)
  const lettered = Object.entries(test?.subst ?? {}).map(([letter, to]) => [letter, arity.get(letter) > 0 && to.op === 'atom' && task.notation.words?.[to.pred] ? task.notation.words[to.pred] : text(to)])
  const notation = { ...task.notation, words: { ...task.notation.words, ...Object.fromEntries(lettered) } }
  const read = (value) => parse(value, { consts })
  return sentencePicker(offer.formula, { read, consts, notation, text: (value) => text(replaceAtoms(read(value), test?.subst ?? {})) })
}

export const proofScreen = {
  course: (game) => game.logic.proofBoards,
  play: { ...proofReadout, runLevel: (task, board, _parts, options) => runProof(task, board, options) },
  settingControls(task, test) {
    const build = language(task, test)
    const occurrences = (props) => {
      const { setting, value } = props
      const [first] = setting.options
      if (!first?.original) return null
      const list = setting.control === 'list'
      const unset = list ? !value?.length : value == null || value === ''
      const fixed = setting.options.length === 1 && (unset || (list ? value.includes(first.value) : value === first.value))
      const selected = fixed && unset ? (list ? [first.value] : first.value) : value
      return <OccurrenceChoice {...props} value={selected} fixed={fixed} text={proofMarkedTextOf(task, test)} />
    }
    return {
      select: occurrences,
      list: occurrences,
      tree: ({ setting, value, onChange, readOnly, id }) => (
        <TreeButton value={value ?? ''} onChange={onChange} build={build} title={setting.label ?? setting.key}
          placeholder={setting.optional ? '—' : T('拼一句')} scope={id} disabled={readOnly} clearable={Boolean(setting.optional)} />
      ),
    }
  },
  context: (task, test) => ({ task, text: textOf(task, test) }),
  // A box moved into or out of another takes another name, and the cards inside it follow (names.js); an instance card
  // with one thing to pick takes it.
  ready: (board, task, _parts, before) => withSoleInstances(before ? followNames(before, board, bindsThing(task.parts), reservedIn(task)) : board, task),
  // A sentence on a card (and the goal wanted) is typeset in TeX, as every formula is.
  typeset: typesetOne(proofReadout.show),
  card: {
    phoneRegionLabel: (node, index) => node.type.split('/').at(-1) === 'orE' ? '①②'[index] : undefined,
    // A box that takes a thing but opens no assumption (For any) shows at its edge the name it takes.
    regionNote: (node, region, ctx) => {
      const name = !ctx.path.length && (ctx.view.played?.run ?? ctx.view).names?.[node.id]
      const frames = ctx.board.parts.frames?.(node) ?? []
      return name && frames.every((r) => !r.opens) ? <span className="vw-value"><span className="tx-lines formula-row"><Formula text={name} upright /></span></span> : undefined
    },
  },
  // A script the proof follows, a line each, indented as its blocks are.
  told: (task, test) => (task.script ? scriptLines(task.script, (t) => textOf(task, test)(parse(t, { consts: [...(task.consts ?? []), ...(task.things ?? [])] }))).map(([depth, text]) => ({ text: `${'  '.repeat(depth)}${text}` })) : []),
  readouts: (_task, _circuit, { score }) => [{ value: score.steps, label: T('步数') }],
  says: { done: T('证明完毕') },
  canvas: { height: 150 },
}
