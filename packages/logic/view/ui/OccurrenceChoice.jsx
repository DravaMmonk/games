import { tr } from 'kernel/words'
import { Formula } from './Formula.jsx'

/** The original sentence, with each replaceable occurrence drawn as one button. */
export default function OccurrenceChoice({ setting, text, value, onChange, readOnly, id }) {
  const { options } = setting
  const { original, replacement } = options[0]
  const indices = new Map(options.map((option) => [option.node, option.value]))
  // Each occurrence splits the formatted sentence into prose, index and subformula.
  const line = text(original, (node, words) => {
    const index = indices.get(node)
    return index === undefined ? words : `\u0000${index}\u0000${words}\u0000`
  }).split('\u0000')
  return (
    <span id={id} className="lg-occurrences" role="group" aria-label={tr('原句中的可代换子式')}>
      {line.map((words, index) => {
        if (index % 3 === 1 || !words.trim()) return null
        if (index % 3 === 0) return <Formula key={index} text={words} />
        const occurrence = line[index - 1]
        const selected = occurrence === String(value ?? '')
        const formula = selected ? text(replacement) : words
        return (
          <button key={occurrence} type="button" className="lg-occurrence" aria-pressed={selected} disabled={readOnly}
            aria-label={tr('第 {index} 处：{formula}', { index: Number(occurrence) + 1, formula })}
            onClick={(event) => { event.stopPropagation(); onChange(selected ? null : occurrence) }}>
            <Formula text={formula} />
          </button>
        )
      })}
    </span>
  )
}
