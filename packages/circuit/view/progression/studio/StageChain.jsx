import { L, summaryOf, isText, shownName } from "kernel/view"
import { tr } from 'kernel/words'
// A part's stages over its page (games/design/README.md 6.8, 6.7): the part itself and its stages in order, one picked to
// preview and edit on the page under it; the fields the stage picked writes, each opening on the right; a new stage at
// the end, changing nothing yet. Every setting there — what the operation declares, what the part narrows, what holds —
// folds out from the bar, the ones the stage changes marked. Icons carry the labels, their tooltips the words.
import { useState } from 'react'
import { Box, GitCompareArrows, Plus, SlidersHorizontal } from 'lucide-react'

import { newStageId, stageChain } from '../../../core/progression/studio-stages.js'

/** A setting in one line: its control, its range or options, its default, whether it is fixed. */
const settingSum = (setting) => {
  if (!setting) return '—'
  const parts = [setting.control]
  if (setting.min !== undefined || setting.max !== undefined) parts.push(`${setting.min ?? ''}…${setting.max ?? ''}`)
  if (setting.options) parts.push(setting.options.map((option) => option.value).join('|'))
  if (setting.default !== undefined) parts.push(`= ${setting.default}`)
  if (setting.fixed) parts.push(tr("固定"))
  return parts.filter(Boolean).join(' ')
}

/** An icon standing for a label: its tooltip and its name the words. */
const Mark = ({ icon: Icon, label }) => <span className="stage-mark" role="img" title={label} aria-label={label}><Icon size={13} aria-hidden="true" /></span>

/**
 * `part` the full id; `raw` its file; `operations` the kernel's declarations; `stage` the one previewed (null: the
 * part); `onStage(id, path)` picks one, or a field in it (its path in parts/<name>.json); `onAdd(stages)` writes the stages.
 */
export default function StageChain({ part, raw, operations, namespace, stage, pending, editable, onStage, onAdd }) {
  const [table, setTable] = useState(false)
  if (!raw) return null
  const chain = stageChain(part, raw, operations)
  const at = chain.find((step) => step.id === stage) ?? chain[0]
  const add = () => {
    const id = newStageId(part, chain.map((step) => step.id))
    onAdd([...(raw.stages ?? []), { id }])
  }
  const open = (step, rest = []) => onStage(step.index ? step.id : null, step.index ? ['stages', step.index - 1, ...rest] : rest)
  const settingsLabel = tr("设置：运算声明、收窄、生效")
  return (
    <section className="stage-bar" aria-label={tr("阶段")}>
      <div className="stage-row">
        <div className="stage-steps" role="tablist" aria-label={tr("阶段")}>
          {chain.map((step) => {
            const on = step.id === at.id
            return step.index
              ? <button key={step.id} type="button" role="tab" aria-selected={on} className={`stage-step ${on ? 'is-on' : ''}`} title={step.id} onClick={() => open(step)}>
                <small>{step.index}</small><code>{shownName(namespace, step.id)}</code>
              </button>
              : <button key={step.id} type="button" role="tab" aria-selected={on} className={`stage-step is-base ${on ? 'is-on' : ''}`} title={tr("元件本体")} aria-label={tr("元件本体")} onClick={() => open(step)}>
                <Box size={13} aria-hidden="true" />
              </button>
          })}
          {editable && <button type="button" className="stage-tool" disabled={pending} title={tr("新的阶段")} aria-label={tr("新的阶段")} onClick={add}><Plus size={13} aria-hidden="true" /></button>}
        </div>
        {at.settings.length > 0 && (
          <button type="button" className={`stage-tool ${table ? 'is-on' : ''}`} aria-pressed={table} title={settingsLabel} aria-label={settingsLabel} onClick={() => setTable((shown) => !shown)}>
            <SlidersHorizontal size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      {at.index > 0 && (
        <div className="stage-changes">
          <Mark icon={GitCompareArrows} label={tr("这个阶段写的字段")} />
          {at.changes.length
            ? at.changes.map((change) => (
              <button key={change.path.join('.')} type="button" className="stage-change" title={(isText(change.value) ? L(change.value) : summaryOf(change.value, 120)) || '{}'} onClick={() => open(at, change.path)}>
                <code>{change.path.join('.')}</code>
              </button>
            ))
            : <span className="stage-none" title={tr("这个阶段还没写字段")}>—</span>}
        </div>
      )}
      {table && at.settings.length > 0 && (
        <div className="stage-table kit-table-scroll">
          <table className="stage-settings">
            <thead><tr><th>{tr("设置")}</th><th>{tr("运算声明")}</th><th>{tr("收窄")}</th><th>{tr("生效")}</th></tr></thead>
            <tbody>
              {at.settings.map((row) => (
                <tr key={row.key} className={row.changed ? 'is-changed' : ''}>
                  <th><code>{row.key}</code></th>
                  <td>{row.declared ? settingSum(row.declared) : tr("元件里写全")}</td>
                  <td>{row.narrowed ? summaryOf(row.narrowed, 60) : '—'}</td>
                  <td>{settingSum(row.effective)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
