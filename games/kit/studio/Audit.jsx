import { T } from '../shell/i18n.js'
// The audit, a tab of the fold bar under the middle (Drawer.jsx): how the check stands (auditSum,
// on the bar) and a worklist: npm run check's lines for the game as the pending changeset
// leaves it, recomputed on every edit, one row a line (worklist.js) — filtered by severity, rule, the level selected
// and words; F8 and Shift+F8 step through them, each step going to the field the line is about (or its level). While
// the whole check of the latest edit is still running, the last one shows faded.
import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { useWorkspaceKeys } from '../shell/useOverlay.js'
import { SEVERITIES, filterItems, stepIn, tally } from './worklist.js'
import { usePref } from './prefs.js'
import { levelLabels } from '../course.js'

const SEVERITY = { fail: [T("不过")], warn: [T("警告")], open: [T("待办")], report: [T("报告", {}, "audit")], advice: [T("规范提示")], pass: [T("通过", {}, "audit")] }
const previewFailed = (last) => last?.ok === false && !last.content
const SHOWN = 400 // rows drawn at most; the rest summed up

/** How the check stands, for the fold bar. */
export function auditSum(items, last) {
  if (previewFailed(last)) return { status: 'fail', label: tr('操作失败') }
  const { severities } = tally(items)
  const fails = severities.get('fail')
  if (fails) return { status: 'fail', label: tr("发现 {fails} 处问题", { fails }) }
  const warnings = severities.get('warn')
  if (warnings) return { status: 'warn', label: tr("发现 {warnings} 条警告", { warnings }) }
  const advice = severities.get('advice')
  if (advice) return { status: 'ok', label: tr("检查通过，{advice} 条规范提示", { advice }) }
  return { status: 'ok', label: tr("检查通过") }
}

/** `open`: the fold bar is open on the audit; `onOpen()` opens it there (F8 steps into a folded one). */
export default function Audit({ chapters, items, fresh, last, at, busy, open, onOpen, onJump, advice }) {
  const [filter, setFilter] = usePref('audit-filter', { severities: ['fail', 'open', 'report'], warnings: true, rule: '', mine: false })
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(-1)
  const levelNumbers = useMemo(() => levelLabels(chapters ?? []), [chapters])
  const { rules, severities } = useMemo(() => tally(items), [items])
  const selected = useMemo(() => {
    const enabled = filter.severities.length ? filter.severities : SEVERITIES.filter(severity => !['warn', 'advice'].includes(severity))
    return filter.warnings ? [...enabled, 'warn'] : enabled
  }, [filter])
  const shown = useMemo(() => filterItems(items, { severities: selected, rules: filter.rule ? [filter.rule] : [], level: filter.mine ? at?.level ?? null : null, query }), [items, filter, selected, at, query])
  useEffect(() => setCursor(-1), [filter, query])
  const go = (k) => {
    setCursor(k)
    if (shown[k]) onJump(shown[k])
  }
  const step = (delta) => {
    if (!open) onOpen()
    go(stepIn(shown.length, Math.min(cursor, shown.length - 1), delta))
  }
  // F8 / Shift+F8, or the palette's next and previous finding.
  useWorkspaceKeys((event) => {
    if (event.key !== 'F8') return
    event.preventDefault()
    step(event.shiftKey ? -1 : 1)
  })
  useEffect(() => {
    const asked = (e) => step(e.detail)
    window.addEventListener('studio:finding', asked)
    return () => window.removeEventListener('studio:finding', asked)
  })
  useEffect(() => { document.querySelector('.audit-row.is-at')?.scrollIntoView({ block: 'nearest' }) }, [cursor])
  const set = (patch) => setFilter((f) => ({ ...f, ...patch }))
  const toggle = (s) => set(s === 'warn' ? { warnings: !filter.warnings } : {
    severities: filter.severities.includes(s) ? filter.severities.filter((x) => x !== s) : [...filter.severities, s],
  })
  const failed = previewFailed(last)
  if (!open) return null
  return (
    <div className={`audit is-open ${busy || !fresh ? 'is-busy' : ''}`} aria-busy={!fresh}>
      <Filters filter={filter} selected={selected} set={set} toggle={toggle} severities={severities} rules={rules} at={at} query={query} setQuery={setQuery} advice={advice} />
      <div className="audit-body">
        {failed && <ul className="audit-lines">{last.problems.map((p) => <li key={p} className="audit-row is-fail is-wide">{p}</li>)}</ul>}
        <Lines levelNumbers={levelNumbers} shown={shown} cursor={cursor} go={go} onSettle={advice.settle} />
      </div>
    </div>
  )
}

/** The worklist's filters: severity (with counts), the level selected, a rule, words. */
function Filters({ filter, selected, set, toggle, severities, rules, at, query, setQuery, advice }) {
  return (
    <div className="audit-filter">
      <div className="seg is-small" role="group" aria-label={tr('严重程度')}>
        {SEVERITIES.map((s) => (
          <button key={s} type="button" className={`is-${s} ${selected.includes(s) ? 'is-on' : ''}`} aria-pressed={selected.includes(s)} onClick={() => toggle(s)} title={L(SEVERITY[s])}>
            <i />{severities.get(s) ?? 0}
          </button>
        ))}
      </div>
      <button type="button" className={`audit-advice ${advice.on ? 'is-on' : ''}`} aria-pressed={advice.on} onClick={advice.toggle} title={tr('后台规范检查')}>
        {advice.on ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
      </button>
      <button type="button" className={`audit-mine ${filter.mine ? 'is-on' : ''}`} aria-pressed={filter.mine} onClick={() => set({ mine: !filter.mine })} disabled={!at?.level} title={tr('只看选中的关')}>{at?.level ?? '—'}</button>
      <select className="audit-rule" value={filter.rule} onChange={(e) => set({ rule: e.target.value })} aria-label={tr("规则")}>
        <option value="">{tr('全部规则')}</option>
        {[...rules].sort(([a], [b]) => a.localeCompare(b)).map(([r, n]) => <option key={r} value={r}>{r} · {n}</option>)}
      </select>
      <input className="audit-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('筛选')} aria-label={tr('筛选')} />
    </div>
  )
}

/** The check's lines as rows, each going to what it is about. */
function Lines({ levelNumbers, shown, cursor, go, onSettle }) {
  return (
    <ol className="audit-lines" aria-label={tr('检查')}>
      {shown.slice(0, SHOWN).map((it, k) => {
        const level = it.levels[0]
        const number = levelNumbers.get(level)
        return (
          <li key={`${k} ${it.text}`} className={`audit-row is-${it.severity} ${it.settled ? 'is-settled' : ''} ${k === cursor ? 'is-at' : ''}`}>
            <button type="button" onClick={() => go(k)} title={it.text}>
              <code>{level ?? it.rule}{number && <> <span className="audit-level-number">({number})</span></>}</code>
              <span>{it.severity === 'warn' && <strong>{tr('警告')} · </strong>}{it.text}</span>
            </button>
            {it.severity === 'advice' && (
              <button type="button" className="audit-settle" onClick={() => onSettle(it)} title={it.settled ? tr('重新打开') : tr('了结')}>
                {it.settled ? <RotateCcw size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
              </button>
            )}
          </li>
        )
      })}
      {shown.length > SHOWN && <li className="audit-more">{tr("还有 {value} 行", {value: shown.length - SHOWN})}</li>}
      {!shown.length && <li className="audit-more">—</li>}
    </ol>
  )
}
