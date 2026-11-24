import { Check, Pencil } from 'lucide-react'
import { punctuation } from 'kernel'
import { tr } from 'kernel/words'
import { goalMark } from '../../core/circuit-readouts.js'
import { rewritePreview } from '../../core/rewrite.js'
import { withBinders } from '../../core/schematic.js'
import { Formula } from './Formula.jsx'

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
    if (index % 3 === 0) return <Formula key={`text-${index}`} text={words} />
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

function SequentLine({ sequent, text, index = 0, sentence = (formula) => <Formula text={text(formula)} />, closed = false }) {
  return (
    <div className="lg-sequent">
      {sequent.fixes?.length > 0 && <Formula text={withBinders(sequent.fixes, '').trimEnd()} />}
      {sequent.hyps.map((formula, hyp) => (
        <span key={hyp} className="lg-sequent-sentence">
          {sentence(formula, hyp)}
          {hyp < sequent.hyps.length - 1 && <Formula text={punctuation('；')} />}
        </span>
      ))}
      <span className="lg-sequent-sentence">
        <Formula text={goalMark(index)} className="lg-sequent-turnstile" />
        {sentence(sequent.goal)}
        {closed && <span className="lg-application-closed" role="img" aria-label={tr('目标已证完')} title={tr('目标已证完')}><Check size="1em" aria-hidden="true" /></span>}
      </span>
    </div>
  )
}

function RewriteSequents({ sequent, options, option, ...props }) {
  const depthOf = (hyp) => option?.hyp === hyp ? option?.depth ?? 0 : 0
  const bySentence = Map.groupBy(options, ({ hyp }) => hyp)
  const contents = (options) => <OccurrenceContents {...props} setting={{ options }} rewrite
    preview={options.includes(option) ? rewritePreview(option) : undefined} />
  const sentence = (formula, hyp) => {
    const matches = bySentence.get(hyp)?.filter(({ depth }) => depth === depthOf(hyp))
    return matches?.length ? contents(matches) : <Formula text={props.text(formula)} />
  }
  const overlaps = Map.groupBy(options.filter(({ hyp, depth }) => depth !== depthOf(hyp)), ({ hyp, depth }) => `${hyp ?? 'goal'}-${depth}`)
  return (
    <>
      <SequentLine sequent={sequent} text={props.text} sentence={sentence} />
      {overlaps.size > 0 && <details className="lg-application-more">
        <summary>{tr('其他可改写位置')}</summary>
        {[...overlaps].map(([key, options]) => <div key={key} className="lg-occurrences">{contents(options)}</div>)}
      </details>}
    </>
  )
}

function BackwardSequents({ sequents, options, option, text, readOnly, fixed, onChange }) {
  const byIndex = new Map(options.map(choice => [choice.index, choice]))
  const extraGoals = option ? Math.max(0, option.result.length - sequents.length) : 0
  return sequents.flatMap((original, index) => {
    const shownIndex = index > option?.index ? index + extraGoals : index
    const choice = byIndex.get(index)
    if (!choice) return <SequentLine key={index} sequent={original} text={text} index={shownIndex} />
    const selected = choice === option
    const replacementCount = choice.result.length - sequents.length + 1
    const closed = selected && replacementCount === 0
    const results = selected && !closed ? choice.result.slice(index, index + replacementCount) : [original]
    const sentence = (formula, hyp) => hyp !== undefined ? <Formula text={text(formula)} /> : (
      <ApplicationBox selected={selected} readOnly={readOnly} fixed={fixed}
        label={tr('第 {index} 处：{formula}', { index: index + 1, formula: text(original.goal) })}
        onPick={() => onChange(choice.value)}>
        <Formula text={text(formula)} />
      </ApplicationBox>
    )
    return results.map((sequent, k) => <SequentLine key={`${index}:${k}`} sequent={sequent} text={text} index={shownIndex + k}
      sentence={k === 0 ? sentence : undefined} closed={closed} />)
  })
}

/** One position picker for applying a rule to a proof state. */
export function MachineApplicationChoice({ setting, id, value, text, readOnly, onChange, rewrite }) {
  const [{ sequents }, ...options] = setting.options
  const configured = rewrite && value === '' ? undefined : value
  const target = configured ?? options[0]?.value
  const picked = rewrite && target === 'hyps' ? options.find(({ hyp }) => hyp !== undefined)?.value
    : rewrite && target === 'goal' ? 'goal-0' : target
  const option = options.find((item) => item.value === picked)
  const fixed = options.length === 1 && option !== undefined
  const props = { options, option, text, readOnly, fixed, onChange }
  const hint = tr('点击框内公式选择应用位置')
  return (
    <div id={id} className="lg-application-result">
      <div className="lg-application-heading">
        <span>{tr('结果')}</span>
        {!readOnly && options.length > 0 && !fixed && <span className="lg-application-hint" role="img" aria-label={hint} title={hint}><Pencil size="1em" aria-hidden="true" /></span>}
      </div>
      <div className="lg-application-lines" role="group" aria-label={tr('应用位置')}>
        {rewrite ? <RewriteSequents {...props} sequent={sequents[0]} value={picked} /> : <BackwardSequents {...props} sequents={sequents} />}
      </div>
      {configured != null && !option ? <span role="status">{tr('找不到选定的应用位置')}</span>
        : !options.length && <span>{tr('没有可应用的位置')}</span>}
    </div>
  )
}
