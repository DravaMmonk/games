import RunDock from '../RunDock.jsx'
import Verdict from '../Verdict.jsx'
import { checkAction } from '../useCheckOnce.js'
import { L, tr } from '../i18n.js'
import { FormulaText } from '../FormulaText.jsx'
import PlayLayout from './PlayLayout.jsx'
import { useCheckedWork } from './useWork.js'

/** Compare values row by row, classify an entire table, or try a row to reveal a value. */
export default function ValueTables({ screen, resource, play }) {
  const { tables, labels, mode } = resource
  const tf = (value) => L(labels.values[Number(value)])
  const { work: state, verdict: checked, check, record, change } = useCheckedWork(screen, {
    read: (saved) => ({ fill: {}, marks: {}, tried: {}, ...saved }),
    write: (state) => state,
  }, resource.judge)
  const update = (patch) => change({ ...state, ...patch })
  const rowStatus = (k) => {
    if (checked?.unanswered.has(k)) return tr('未作答')
    if (checked?.wrong.has(k)) return tr('答错')
    return null
  }
  const tryRow = (f, k) => {
    const next = { ...state, tried: { ...state.tried, [`${f}:${k}`]: true } }
    change(next)
    if (resource.hit(f, k)) record({ pass: true, unanswered: new Set(), wrong: new Set() }, next)
  }

  const table = (fi, { fill = false } = {}) => {
    const { headers, title, rows } = tables[fi]
    return (
      <table className="vt-table">
        <thead><tr>{headers.map((header, k) => <th key={k}><FormulaText text={header} /></th>)}<th className="is-value"><FormulaText text={title} /></th></tr></thead>
        <tbody>
          {rows.map(({ given, value }, k) => {
            const tried = state.tried[`${fi}:${k}`]
            const guess = state.fill[k]
            const bad = fill && checked?.wrong.has(k)
            const status = fill && rowStatus(k)
            const answer = guess === undefined ? tr('未作答') : tf(guess)
            return (
              <tr key={k} className={bad ? 'is-wrong' : ''}>
                {given.map((item, j) => <td key={j} className={item ? 'is-t' : 'is-f'}>{tf(item)}</td>)}
                <td className="is-value">
                  {fill ? (
                    <div className="vt-answer">
                      <button type="button" className={`vt-cell ${guess === undefined ? '' : guess ? 'is-t' : 'is-f'}`} onClick={() => update({ fill: { ...state.fill, [k]: guess === undefined ? true : guess ? false : undefined } })} aria-label={tr('第 {k} 行：{value}', { k: k + 1, value: bad ? `${answer} · ${status}` : answer })}>{guess === undefined ? '?' : answer}</button>
                      {status && <span className="vt-answer-status" aria-hidden="true">{status}</span>}
                    </div>
                  ) : tried ? (
                    <span className={`vt-cell is-shown ${value ? 'is-t' : 'is-f'}`}>{tf(value)}</span>
                  ) : (
                    <button type="button" className="vt-cell" onClick={() => tryRow(fi, k)}>{tr('尝试')}</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const stage = (
    <div className={play.stage}>
      {mode === 'fill' && table(0, { fill: true })}
      {mode === 'try' && table(0)}
      {mode === 'classify' && tables.map(({ title }, k) => (
        <section key={k} className={`vt-claim ${checked?.wrong.has(k) ? 'is-wrong' : ''}`}>
          <header>
            <b><FormulaText text={title} /></b>
            {rowStatus(k) && <span className="vt-answer-status">{rowStatus(k)}</span>}
            <span className="vt-mark-pick" role="group">
              {[[true, L(labels.classify[1])], [false, L(labels.classify[0])]].map(([v, label]) => (
                <button key={label} type="button" aria-pressed={state.marks[k] === v} onClick={() => update({ marks: { ...state.marks, [k]: v } })}>{label}</button>
              ))}
            </span>
          </header>
          <details><summary>{L(labels.inspect)}</summary>{table(k)}</details>
        </section>
      ))}
    </div>
  )
  // Trying rows needs no check: each row tried shows its value, and the one asked for passes the level.
  const tried = mode === 'try' && play.checks === 'shown'
  const results = checked && (
    <Verdict pass={checked.pass}>
      {checked.pass ? L(resource.accepted) : mode === 'try' ? L(resource.retry) : <>
        {checked.unanswered.size > 0 && tr('还有 {count} 项未作答。', { count: checked.unanswered.size })}
        {checked.unanswered.size > 0 && checked.wrong.size > 0 && ' '}
        {checked.wrong.size > 0 && tr('有 {count} 项答错，请修改标出的答案。', { count: checked.wrong.size })}
      </>}
    </Verdict>
  )
  const dock = !tried && <RunDock go={checkAction(check, Boolean(checked?.pass))} />
  return <PlayLayout screen={screen} play={play} stage={tried ? <>{stage}{results}</> : stage} results={tried ? undefined : results} dock={dock} />
}
