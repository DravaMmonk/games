import { createContext, useContext } from 'react'
import { LocateOff } from 'lucide-react'
import { sameJson } from 'kernel'
import { tr } from 'kernel/words'
import { rewritePreview } from '../../core/rewrite.js'
import { Formula } from './Formula.jsx'
import { Piece, Sentence, StateLayout } from './ProofState.jsx'

/** Whether the card drawn stands in a search frame: a backward rule with no goal picked then works on the first
 *  goal alone, so the picker marks that goal or none (the machine screen provides it around a card's face). */
export const FirstGoalOnly = createContext(false)
/** Whether the card drawn runs again on later states (a repeat or search frame's region): the one place its first
 *  round offers is no settled choice there, so the player can still pin it. */
export const RunsAgain = createContext(false)

function ApplicationBox({ selected, auto = false, readOnly, fixed, label, onPick, children }) {
  return (
    <button type="button" className={`lg-occurrence ${auto ? 'is-auto' : ''}`} aria-pressed={selected} disabled={readOnly}
      aria-disabled={fixed || undefined} aria-label={label} onClick={event => { event.stopPropagation(); if (!fixed) onPick() }}>
      <span className="lg-occurrence-frame">{children}</span>
    </button>
  )
}

/** The original sentence, with each replaceable occurrence drawn as one button. */
export default function OccurrenceChoice({ id, label, ...props }) {
  return (
    <span id={id} className="lg-occurrences" role="group" aria-label={label ?? tr('原句中的可代换子式')}>
      <OccurrenceContents {...props} />
    </span>
  )
}

function OccurrenceContents({ setting, text, value, applied = value, onChange, readOnly, fixed = false, preview, rewrite = false }) {
  const { options } = setting
  const original = preview?.original ?? options[0].original
  const indices = new Map(options.map((option) => [option.value === applied && preview ? preview.node : option.node, option]))
  // Each occurrence splits the formatted sentence into prose, index and subformula.
  const line = text(original, (node, words) => {
    const option = indices.get(node)
    return option ? `\u0000${option.value}\u0000${words}\u0000` : words
  }).split('\u0000')
  const multiple = setting.control === 'list'
  const selection = multiple ? (value ?? []) : [String(value ?? '')]
  const byValue = new Map(options.map((option) => [option.value, option]))
  return line.map((words, index) => {
    if (index % 3 === 1 || !words.trim()) return null
    if (index % 3 === 0) return <Piece key={`text-${index}`} text={words} />
    const occurrence = line[index - 1]
    const selected = selection.includes(occurrence)
    // The place a card acts on without having been picked: drawn as the change it makes, still a place to pick.
    const auto = !selected && occurrence === applied && Boolean(preview)
    const option = byValue.get(occurrence)
    const formula = selected && !preview ? text(option.replacement) : words
    // On a card the place acted on shows what the rewrite made there.
    const pick = () => {
      if (multiple) onChange(selected ? selection.filter((item) => item !== occurrence) : [...selection, occurrence])
      else onChange(selected && !rewrite ? null : occurrence)
    }
    return (
      <ApplicationBox key={`pick-${index}`} selected={selected} auto={auto} readOnly={readOnly} fixed={fixed}
        label={tr('第 {index} 处：{formula}', { index: (option.index ?? Number(occurrence)) + 1, formula })} onPick={pick}>
        {rewrite && (selected || auto) ? <span className="lg-made"><Formula text={formula} /></span> : <Formula text={formula} />}
      </ApplicationBox>
    )
  })
}

// A given as a card marks it: matched by its rule, made by it, or neither.
const Given = ({ formula, text, role }) => role === 'matched'
  ? <span className="lg-matched"><Sentence formula={formula} text={text} /></span>
  : <Sentence formula={formula} text={text} whole={role === 'made'} />

// Goals that share their fixed things and knowns stand in one group, each given marked as a goal of the group marks it
// (`marks`: role by given); a goal whose knowns hold places to pick keeps its own.
function grouped(rows, text) {
  const groups = []
  for (const { sequent, hyps, marks = {}, ...goal } of rows) {
    const fixes = sequent.fixes ?? []
    let group = !hyps && groups.find((other) => other.shared && sameJson(other.fixes, fixes) && sameJson(other.given, sequent.hyps))
    if (!group) {
      group = { shared: !hyps, fixes, given: sequent.hyps, hyps, marks: {}, goals: [] }
      groups.push(group)
    }
    Object.assign(group.marks, marks)
    group.goals.push(goal)
  }
  return groups.map(({ given, hyps, marks, ...group }) => ({
    ...group, hyps: hyps ?? given.map((formula, k) => <Given key={k} formula={formula} text={text} role={marks[k]} />),
  }))
}

function rewriteRows({ sequents, options, option, ...props }) {
  const contents = (matches) => <OccurrenceContents {...props} setting={{ options: matches }} rewrite applied={option?.value}
    preview={matches.includes(option) ? rewritePreview(option) : undefined} />
  const overlaps = new Map()
  const rows = sequents.map((sequent, index) => {
    const here = options.filter(({ goalIndex = 0 }) => goalIndex === index)
    const depthOf = (hyp) => (option && here.includes(option) && option.hyp === hyp ? option.depth ?? 0 : 0)
    const at = (hyp) => here.filter((choice) => choice.hyp === hyp)
    // The given a substitution reads its equation off is matched.
    const source = option && here.includes(option) ? option.source : undefined
    const sentence = (formula, hyp) => {
      const matches = at(hyp).filter(({ depth }) => depth === depthOf(hyp))
      return matches.length ? <span className="ps-sentence">{contents(matches)}</span>
        : <Given formula={formula} text={props.text} role={hyp !== undefined && hyp === source ? 'matched' : undefined} />
    }
    for (const choice of here.filter(({ hyp, depth }) => depth !== depthOf(hyp))) {
      const key = `${index}-${choice.hyp ?? 'goal'}-${choice.depth}`
      if (!overlaps.has(key)) overlaps.set(key, [])
      overlaps.get(key).push(choice)
    }
    const picksKnown = here.some(({ hyp }) => hyp !== undefined)
    return {
      sequent, index, body: sentence(sequent.goal),
      ...(picksKnown ? { hyps: sequent.hyps.map((formula, hyp) => <span key={hyp}>{sentence(formula, hyp)}</span>) }
        : source !== undefined && { marks: { [source]: 'matched' } }),
    }
  })
  return { rows, more: [...overlaps].map(([key, hidden]) => <div key={key} className="lg-occurrences">{contents(hidden)}</div>) }
}

function backwardRows({ sequents, options, option, text, readOnly, fixed, onChange }) {
  const byIndex = new Map(options.map(choice => [choice.index, choice]))
  const extraGoals = option ? Math.max(0, option.result.length - sequents.length) : 0
  const rows = sequents.flatMap((original, index) => {
    const shownIndex = index > option?.index ? index + extraGoals : index
    const choice = byIndex.get(index)
    if (!choice) return { sequent: original, index: shownIndex, body: <Sentence formula={original.goal} text={text} /> }
    const selected = choice === option
    const replacementCount = choice.result.length - sequents.length + 1
    const closed = selected && replacementCount === 0
    const results = selected && !closed ? choice.result.slice(index, index + replacementCount) : [original]
    const made = selected && !closed
    // The place picked shows what the rule leaves there: its first goal in the box, the goals it adds after it, all
    // made, with the givens it adds; a goal it copies from a given marks that given matched.
    const marks = (sequent) => made
      ? Object.fromEntries(sequent.hyps.flatMap((hyp, k) => (original.hyps.some((old) => sameJson(old, hyp)) ? [] : [[k, 'made']])))
      : closed ? Object.fromEntries((choice.hyps ?? []).filter((k) => k >= 0).map((k) => [k, 'matched'])) : {}
    return results.map((sequent, k) => ({
      sequent, index: shownIndex + k, closed, marks: marks(sequent),
      body: k > 0 ? <Sentence formula={sequent.goal} text={text} whole /> : (
        <ApplicationBox selected={selected} readOnly={readOnly} fixed={fixed}
          label={tr('第 {index} 处：{formula}', { index: index + 1, formula: text(original.goal) })}
          onPick={() => onChange(choice.value)}>
          <Sentence formula={sequent.goal} text={text} whole={made} />
        </ApplicationBox>
      ),
    }))
  })
  return { rows, more: [] }
}

/**
 * A rule used forwards, drawn as the state it leaves: each given its first premise can read is a box, the one it reads
 * framed; the other givens it reads matched; the givens it adds made, as are goals its premises still to prove add. Groups starting on the same
 * given show the first, the one a run takes.
 */
function forwardRows({ sequents, options, option, text, readOnly, fixed, onChange }) {
  const first = new Map()
  for (const choice of options) if (!first.has(choice.index)) first.set(choice.index, choice)
  const [goal, ...rest] = sequents
  const result = option?.result ?? sequents
  const closed = option !== undefined && result.length < sequents.length
  const added = (k, formula) => (option?.addedHyps ?? []).some(({ goalIndex, hyps }) => goalIndex === k && hyps.some((hyp) => sameJson(hyp, formula)))
  // The givens the rule reads besides the one picked are matched; those it adds are made.
  const role = (k, formula, hyp) => (added(k, formula) ? 'made' : k === 0 && option?.indices?.slice(1).includes(hyp) ? 'matched' : undefined)
  // The goals the rule leaves in place of the first: its own, with what it added, then any it opened.
  const opened = closed ? [goal] : result.slice(0, result.length - rest.length)
  const rows = opened.map((sequent, k) => ({
    sequent, index: k, closed, body: <Sentence formula={sequent.goal} text={text} whole={k > 0} />,
    hyps: sequent.hyps.map((formula, hyp) => {
      const choice = k === 0 && first.get(hyp)
      const sentence = <Given formula={formula} text={text} role={role(k, formula, hyp)} />
      if (!choice) return <span key={hyp}>{sentence}</span>
      return (
        <ApplicationBox key={hyp} selected={choice.index === option?.index} readOnly={readOnly} fixed={fixed}
          label={tr('第 {index} 处：{formula}', { index: hyp + 1, formula: text(goal.hyps[hyp]) })} onPick={() => onChange(choice.value)}>
          {sentence}
        </ApplicationBox>
      )
    }),
  }))
  rest.forEach((sequent, k) => rows.push({ sequent, index: opened.length + k, body: <Sentence formula={sequent.goal} text={text} /> }))
  return { rows, more: [] }
}

/**
 * Where a rule applies to the proof state handed to its card, drawn as the state the rule leaves: the place it acts on
 * framed, the givens its rule matches besides and what it makes in their colours (BoundRule.jsx marks the rule alike). Every other place it could act on is a box to pick, drawn once the card is selected or the
 * picker stands in a detail sheet; a place picked by hand keeps its frame. With several places and none picked the rule
 * waits: the state stands as it came, every place a box.
 */
export function MachineApplicationChoice({ setting, id, value, text, readOnly, onChange, direction = 'backward' }) {
  const [{ sequents, defaultAt }, ...options] = setting.options
  const rewrite = direction === 'rewrite'
  const forward = direction === 'forward'
  const firstOnly = useContext(FirstGoalOnly) && direction === 'backward'
  const again = useContext(RunsAgain) && rewrite
  const configured = value == null || value === '' ? undefined : value
  const target = configured ?? (firstOnly ? options.find(({ index }) => index === 0)?.value : defaultAt)
  const picked = rewrite && target === 'hyps' ? options.find(({ hyp }) => hyp !== undefined)?.value
    : rewrite && target === 'goal' ? 'goal-0' : target
  const option = options.find((item) => item.value === picked)
  // A rewrite in a frame that runs it again acts on its one place unpicked: later rounds may offer more.
  const places = forward ? new Set(options.map(({ index }) => index)).size : options.length
  const fixed = places === 1 && option !== undefined && !again
  const props = { sequents, options, option, text, readOnly, fixed, onChange }
  const { rows, more } = rewrite ? rewriteRows({ ...props, value: again && configured === undefined ? undefined : picked })
    : forward ? forwardRows(props) : backwardRows(props)
  const missing = configured !== undefined && !option
  // Several places and none picked: the card waits for the player, every place a box. In a search frame it does not
  // wait: with the first goal out of its rule's reach it hands the state on.
  // A rule used forwards never waits: it reads the first group it can.
  const pending = !readOnly && !forward && configured === undefined && !option && options.length > 1 && !firstOnly
  return (
    <div id={id} className={`lg-application-result ${pending ? 'is-pending' : ''}`} role="group" aria-label={tr('应用位置')}>
      <StateLayout groups={grouped(rows, text)} next={option && direction === 'backward' ? option.index : option?.goalIndex ?? 0} />
      {more.length > 0 && <details className="lg-application-more">
        <summary>{tr('其他可改写位置')}</summary>
        {more}
      </details>}
      {missing && <span className="lg-application-missing" role="img" aria-label={tr('找不到选定的应用位置')} title={tr('找不到选定的应用位置')}><LocateOff size="1em" aria-hidden="true" /></span>}
    </div>
  )
}
