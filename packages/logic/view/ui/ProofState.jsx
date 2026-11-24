// A proof state as the prover draws it wherever one stands (a report box, a card, a phone tile, the position picker):
// goals that share their fixed things and knowns write those once, with the goals in a column beside them. With several
// goals open, the one a rule acts on by default keeps the accent on its mark. What a step changed is tinted, a goal
// it added tinted whole, and a letter still unknown (?A) is drawn in the accent wherever it stands.
import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { getLang, punctuation } from 'kernel'
import { FormulaText } from 'kernel/view'
import { tr } from 'kernel/words'
import { render } from '../../core/notation.js'
import { isMetaName, withBinders } from '../../core/schematic.js'
import { proofStateDiff, proofStateInfo } from '../../core/proof-state-info.js'
import { goalMark, machineLines } from '../../core/circuit-readouts.js'
import { texOf } from '../../core/tex.js'
import { Formula, MarkedFormula } from './Formula.jsx'

/** A task's sentences as text, each subformula passed to `mark(node, words)` on the way. */
export const markedTextOf = (task) => (formula, mark) => render(formula, task.notation, getLang(), -1, mark)

const OPEN = '\u0001'
const NAMED = '\u0002'
const CLOSE = '\u0003'

/** A sentence's text cut at the subformulas `kindOf(node)` names: strings and { kind, children } nested as they are. */
function piecesOf(formula, text, kindOf) {
  const line = text(formula, (node, words) => {
    const kind = kindOf(node)
    return kind ? `${OPEN}${kind}${NAMED}${words}${CLOSE}` : words
  })
  const root = { children: [] }
  const open = [root]
  let from = 0
  const flush = (to) => { if (to > from) open.at(-1).children.push(line.slice(from, to)) }
  for (let at = 0; at < line.length; at++) {
    if (line[at] === OPEN) {
      flush(at)
      const named = line.indexOf(NAMED, at)
      const piece = { kind: line.slice(at + 1, named), children: [] }
      open.at(-1).children.push(piece)
      open.push(piece)
      at = named
      from = named + 1
    } else if (line[at] === CLOSE) {
      flush(at)
      open.pop()
      from = at + 1
    }
  }
  flush(line.length)
  return root.children
}

/** A stretch of a sentence cut out of it: an empty group stands where the cut took a neighbour away, so a sign at
 *  the edge keeps the spacing of a sign between two things. */
export function Piece({ text }) {
  const tex = `${/^\s/.test(text) ? '{}' : ''}${texOf(text)}${/\s$/.test(text) ? '{}' : ''}`
  return <FormulaText text={text} className="tx-line" tex={tex} />
}

function Pieces({ pieces, draw }) {
  return pieces.map((piece, k) => {
    if (typeof piece === 'string') return piece.trim() ? <Piece key={k} text={piece} /> : null
    return <Fragment key={k}>{draw(piece.kind, <Pieces pieces={piece.children} draw={draw} />)}</Fragment>
  })
}

const UNKNOWN = 'u'
const CHANGED = 'c'
const isUnknown = (node) => (node.op === 'meta' || node.t === 'var') && isMetaName(node.name)
const drawMark = (kind, children) => {
  const body = kind.includes(UNKNOWN) ? <span className="lg-unknown">{children}</span> : children
  return kind.includes(CHANGED) ? <mark className="lg-changed">{body}</mark> : body
}

// A copy of a sentence in which the subformula at `path` is an object of its own. Formulas share subformulas (a
// rewrite puts the same replacement in two places), so a place can only be told apart by where it stands.
function alone(formula, path) {
  if (!path.length) return { ...formula }
  const [key, ...rest] = path
  if (key === 'args') return { ...formula, args: formula.args.map((arg, k) => (k === rest[0] ? alone(arg, rest.slice(1)) : arg)) }
  return { ...formula, [key]: alone(formula[key], rest) }
}
const at = (formula, path) => path.reduce((node, key) => node?.[key], formula)

/** One sentence of a state: its unknown letters in the accent, the subformulas at `paths` (or all of it) tinted. */
export function Sentence({ formula, text, paths = [], whole = false }) {
  const shown = paths.filter((path) => at(formula, path)).reduce(alone, formula)
  const marked = new Set(paths.map((path) => at(shown, path)))
  const kindOf = (node) => `${marked.has(node) ? CHANGED : ''}${isUnknown(node) ? UNKNOWN : ''}`
  const body = <span className="ps-sentence"><Pieces pieces={piecesOf(shown, text, kindOf)} draw={drawMark} /></span>
  return whole ? <mark className="lg-changed">{body}</mark> : body
}

/**
 * A state's lines laid out: `groups` = [{ fixes, hyps: [element], goals: [{ index, body, closed? }] }], a group for the
 * goals that share their fixed things and knowns; `next` the goal a rule acts on by default.
 */
export function StateLayout({ groups, next = null }) {
  const several = groups.reduce((count, group) => count + group.goals.length, 0) > 1
  return (
    <span className="ps">
      {groups.map((group, k) => (
        <span key={k} className="ps-group">
          {(group.fixes.length > 0 || group.hyps.length > 0) && (
            <span className="ps-given">
              {group.fixes.length > 0 && <Formula text={withBinders(group.fixes, '').trimEnd()} />}
              {group.hyps.map((hyp, i) => <span key={i} className="ps-hyp">{hyp}{i < group.hyps.length - 1 && <Formula text={punctuation('；')} />}</span>)}
            </span>
          )}
          <span className="ps-goals">
            {group.goals.map(({ index, body, closed }) => (
              <span key={index} className={`ps-goal ${several && index !== next ? 'is-later' : ''}`}>
                <Formula text={goalMark(index)} className="ps-mark" />
                {body}
                {closed && <span className="ps-closed" role="img" aria-label={tr('目标已证完')} title={tr('目标已证完')}><Check size="1em" aria-hidden="true" /></span>}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}

/** Where a step changed each sentence (core proof-state-info.js proofStateDiff): the paths, by goal and known. */
function changedIn(diff) {
  const paths = new Map()
  for (const { goalIndex, locations } of diff?.changed ?? []) {
    for (const { hyp, path } of locations) {
      const key = `${goalIndex}:${hyp ?? ''}`
      if (!paths.has(key)) paths.set(key, [])
      paths.get(key).push(path)
    }
  }
  return (goalIndex, hyp) => paths.get(`${goalIndex}:${hyp ?? ''}`)
}

/** A proof state with goals open; `diff` what the step that gave it changed, when a step did. */
export function ProofState({ value, text, diff }) {
  const info = proofStateInfo(value)
  // A rule used backwards replaces the goal it acts on, so that goal is marked whole, like the goals it adds.
  const replaced = diff && value.did?.op === 'rule' ? value.did.goalIndex ?? 0 : null
  const paths = changedIn(diff)
  const added = new Set(diff?.added)
  const groups = info.contexts.map(({ fixes, hyps, goalIndices }) => ({
    fixes,
    hyps: hyps.map((hyp, i) => <Sentence key={i} formula={hyp} text={text} paths={paths(goalIndices[0], i)} />),
    goals: goalIndices.map((index) => ({
      index, body: <Sentence formula={value.goals[index].goal} text={text} paths={index === replaced ? [] : paths(index)}
        whole={index === replaced || added.has(index)} />,
    })),
  }))
  return <StateLayout groups={groups} next={info.defaultGoalIndex} />
}

/**
 * A rule-bound card's own state on a phone tile, read only: what the card gave, with what it changed tinted as a
 * report box tints it. The marks come from the state it was handed and the state it gave alone, so they stand whether
 * or not the card's output reaches the result. Places are picked in the card's detail, where they are boxes.
 */
export function StepState({ before, value, text }) {
  const diff = before?.kind === 'state' && value.didBy ? proofStateDiff(before, value, { did: value.did }) : undefined
  return <span className="tx-lines formula-row"><ProofState value={value} text={text} diff={diff} /></span>
}

function MachineFormula({ line }) {
  if (line.goals) return (
    <span className="tx-marked">
      {line.goals.map((goal, k) => (
        <Fragment key={k}>
          {k > 0 && <> <Formula text="|" /> </>}
          <MachineFormula line={goal} />
        </Fragment>
      ))}
    </span>
  )
  return line.mark ? <MarkedFormula line={line} /> : <Formula text={line.s} upright={line.upright} />
}

/** A machine value as a card shows it: only what it is (its formulas, typeset, or 证明完毕), never a note on it (why a
 *  step failed, how many results: the run report says those). */
export const typesetMachine = (v, ctx) => {
  if (v?.kind === 'state' && v.goals.length) return (
    <span className="tx-lines formula-row"><ProofState value={v} text={markedTextOf(ctx.task)} /></span>
  )
  const lines = machineLines(v, ctx).filter((l) => l.formula || l.result)
  return (
    <span className="tx-lines formula-row">
      {lines.length ? lines.map((line, k) => line.formula
        ? <MachineFormula key={k} line={line} />
        : <span key={k} className="tx-prose">{line.s}</span>) : '—'}
    </span>
  )
}
