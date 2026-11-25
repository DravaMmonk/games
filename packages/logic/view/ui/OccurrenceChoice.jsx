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

function ApplicationBox({ selected, readOnly, fixed, label, onPick, children }) {
  return (
    <button type="button" className="lg-occurrence" aria-pressed={selected} disabled={readOnly}
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

function OccurrenceContents({ setting, text, value, onChange, readOnly, fixed = false, preview, rewrite = false }) {
  const { options } = setting
  const original = preview?.original ?? options[0].original
  const indices = new Map(options.map((option) => [option.value === value && preview ? preview.node : option.node, option]))
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
    const option = byValue.get(occurrence)
    const formula = selected && !preview ? text(option.replacement) : words
    const pick = () => {
      if (multiple) onChange(selected ? selection.filter((item) => item !== occurrence) : [...selection, occurrence])
      else onChange(selected && !rewrite ? null : occurrence)
    }
    return (
      <ApplicationBox key={`pick-${index}`} selected={selected} readOnly={readOnly} fixed={fixed}
        label={tr('第 {index} 处：{formula}', { index: (option.index ?? Number(occurrence)) + 1, formula })} onPick={pick}>
        <Formula text={formula} />
      </ApplicationBox>
    )
  })
}

// Goals that share their fixed things and knowns stand in one group; a goal whose knowns hold places to pick keeps its own.
function grouped(rows, text) {
  const groups = []
  for (const { sequent, hyps, ...goal } of rows) {
    const fixes = sequent.fixes ?? []
    let group = !hyps && groups.find((other) => other.shared && sameJson(other.fixes, fixes) && sameJson(other.given, sequent.hyps))
    if (!group) {
      group = { shared: !hyps, fixes, given: sequent.hyps, hyps: hyps ?? sequent.hyps.map((formula, k) => <Sentence key={k} formula={formula} text={text} />), goals: [] }
      groups.push(group)
    }
    group.goals.push(goal)
  }
  return groups
}

function rewriteRows({ sequents, options, option, ...props }) {
  const contents = (matches) => <OccurrenceContents {...props} setting={{ options: matches }} rewrite
    preview={matches.includes(option) ? rewritePreview(option) : undefined} />
  const overlaps = new Map()
  const rows = sequents.map((sequent, index) => {
    const here = options.filter(({ goalIndex = 0 }) => goalIndex === index)
    const depthOf = (hyp) => (option && here.includes(option) && option.hyp === hyp ? option.depth ?? 0 : 0)
    const at = (hyp) => here.filter((choice) => choice.hyp === hyp)
    const sentence = (formula, hyp) => {
      const matches = at(hyp).filter(({ depth }) => depth === depthOf(hyp))
      return matches.length ? <span className="ps-sentence">{contents(matches)}</span> : <Sentence formula={formula} text={props.text} />
    }
    for (const choice of here.filter(({ hyp, depth }) => depth !== depthOf(hyp))) {
      const key = `${index}-${choice.hyp ?? 'goal'}-${choice.depth}`
      if (!overlaps.has(key)) overlaps.set(key, [])
      overlaps.get(key).push(choice)
    }
    const picksKnown = here.some(({ hyp }) => hyp !== undefined)
    return {
      sequent, index, body: sentence(sequent.goal),
      ...(picksKnown && { hyps: sequent.hyps.map((formula, hyp) => <span key={hyp}>{sentence(formula, hyp)}</span>) }),
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
    // The place picked shows what the rule leaves there: its first goal in the box, the goals it adds after it.
    return results.map((sequent, k) => ({
      sequent, index: shownIndex + k, closed,
      body: k > 0 ? <Sentence formula={sequent.goal} text={text} whole /> : (
        <ApplicationBox selected={selected} readOnly={readOnly} fixed={fixed}
          label={tr('第 {index} 处：{formula}', { index: index + 1, formula: text(original.goal) })}
          onPick={() => onChange(choice.value)}>
          <Sentence formula={sequent.goal} text={text} />
        </ApplicationBox>
      ),
    }))
  })
  return { rows, more: [] }
}

/**
 * Where a rule applies to the proof state handed to its card, drawn as the state the rule leaves: the place it acts on
 * tinted as a change. Every other place it could act on is a box to pick, drawn once the card is selected or the
 * picker stands in a detail sheet; a place picked by hand keeps its frame. With several places and none picked the rule
 * waits: the state stands as it came, every place a box.
 */
export function MachineApplicationChoice({ setting, id, value, text, readOnly, onChange, rewrite }) {
  const [{ sequents, defaultAt }, ...options] = setting.options
  const firstOnly = useContext(FirstGoalOnly) && !rewrite
  const configured = value == null || value === '' ? undefined : value
  const target = configured ?? (firstOnly ? options.find(({ index }) => index === 0)?.value : defaultAt)
  const picked = rewrite && target === 'hyps' ? options.find(({ hyp }) => hyp !== undefined)?.value
    : rewrite && target === 'goal' ? 'goal-0' : target
  const option = options.find((item) => item.value === picked)
  const fixed = options.length === 1 && option !== undefined
  const props = { sequents, options, option, text, readOnly, fixed, onChange }
  const { rows, more } = rewrite ? rewriteRows({ ...props, value: picked }) : backwardRows(props)
  const missing = configured !== undefined && !option
  // Several places and none picked: the card waits for the player, every place a box. In a search frame it does not
  // wait: with the first goal out of its rule's reach it hands the state on.
  const pending = !readOnly && configured === undefined && !option && options.length > 1 && !firstOnly
  return (
    <div id={id} className={`lg-application-result ${pending ? 'is-pending' : ''}`} role="group" aria-label={tr('应用位置')}>
      <StateLayout groups={grouped(rows, text)} next={option ? (rewrite ? option.goalIndex ?? 0 : option.index) : 0} />
      {more.length > 0 && <details className="lg-application-more">
        <summary>{tr('其他可改写位置')}</summary>
        {more}
      </details>}
      {missing && <span className="lg-application-missing" role="img" aria-label={tr('找不到选定的应用位置')} title={tr('找不到选定的应用位置')}><LocateOff size="1em" aria-hidden="true" /></span>}
    </div>
  )
}
