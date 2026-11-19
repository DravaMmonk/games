import { EyeOff } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { L, tr } from './i18n.js'


import { usePointerSession } from '../views/usePointerSession.js'


/**
 * A level on a desktop, the same in every game and every kind of level.
 *
 *   left       task navigation and the task board (brief)
 *   middle     what the level is played on (stage): a board that fills it, or one that scrolls (`scroll`: a
 *              table, a sentence, rows to fill in); over a board, the tools as one row of icons
 *   strip      a header with the tests and how they stand (tests, status), when the level has them; then the results
 *              (what a run or check gives: outputs, the test board, the verdict; no "Test N" heading, the tabs name the test; `resultsTitle`, `resultsAside` head
 *              it) and, in a narrow column at the bottom right, the run bar (dock)
 *
 * `results` left out: the level has no results pane (the run bar alone, at the right); null: the pane is there, empty
 * until there is something to show. The line along the strip's top drags it taller or shorter, and the height is
 * remembered for every game. `resultsHeight`: the share of the screen the strip starts at with a results pane (a play's
 * own; else 0.35).
 */
export default function Workbench({ rootRef: given, className = '', brief, taskNav, tools, stage, scroll = false, tests, status, results, resultsTitle, resultsAside, dock, resultsHeight }) {
  const own = useRef(null)
  const rootRef = given ?? own
  const pane = results !== undefined
  return (
    <div ref={rootRef} className={`level ${className}`} style={resultsHeight ? { '--world-start-share': `${resultsHeight * 100}dvh` } : undefined}>
      <aside className="brief">{taskNav}{brief}</aside>
      <div className={`stage-pane ${scroll ? 'is-scroll' : 'is-board'}`}>
        {tools && <div className="wb-toolbar" aria-label={tr("工具")}>{tools}</div>}
        <div className="wb-stage">{stage}</div>
      </div>
      {(pane || dock || tests || status) && (
        <section className="wb-strip">
          {pane && <WorldHandle rootRef={rootRef} />}
          {(tests || status) && (
            <header className="wb-strip-head">
              <div className="wb-tests">{tests}</div>
              {status}
            </header>
          )}
          <div className="wb-strip-body">
            {pane && (
              <section className="wb-pane wb-results">
                {(resultsTitle || resultsAside) && <header className="wb-pane-head"><span>{resultsTitle}</span>{resultsAside}</header>}
                <div className="wb-pane-body">{results}</div>
              </section>
            )}
            {dock && <div className="wb-actions"><footer className="run-foot">{dock}</footer></div>}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * How the tests stand, at the end of the strip's header: a dot for each (passed, failed, running or not run), the
 * count passed, and the hidden tests behind an eye (red when one of them fails).
 * states: ['pass' | 'fail' | 'run' | null]   hidden: { count, failed?, note? }
 */
export function TestStatus({ states, hidden }) {
  const passed = states.filter((s) => s === 'pass').length
  const ran = states.some((s) => s === 'pass' || s === 'fail')
  return (
    <div className={`wb-status ${ran && passed === states.length ? 'is-pass' : ''}`} aria-label={tr("{passed} / {length} 通过", {passed, length: states.length})}>
      <span className="wb-dots" aria-hidden="true">{states.map((s, k) => <i key={k} className={s ? `is-${s}` : ''} />)}</span>
      <b>{ran ? passed : '–'}/{states.length}</b>
      {hidden?.count > 0 && (
        <span className={`wb-hidden ${hidden.failed ? 'is-fail' : ''}`} title={L(hidden.note)}>
          <EyeOff size={13} aria-hidden="true" />
          {hidden.failed ? tr("{failed} 个未通过", {failed: hidden.failed}) : `+${hidden.count}`}
        </span>
      )}
    </div>
  )
}

const WORLD_KEY = 'kit.world-h'

// The strip fits what it holds until the player drags its edge; that height is kept (for every level and game), and a
// double click on the edge goes back to fitting.
const setHeight = (el, h) => {
  el.style.setProperty('--world-h', `${h}px`)
  el.style.setProperty('--world-max', 'none')
  el.style.setProperty('--world-start', '0px')
}

function WorldHandle({ rootRef }) {
  const { track } = usePointerSession()
  useLayoutEffect(() => {
    let h = null
    try { h = Number(localStorage.getItem(WORLD_KEY)) || null } catch { /* storage may be off */ }
    if (h && rootRef.current) setHeight(rootRef.current, h)
  }, [rootRef])
  // The least a drag leaves: the tests' header and the run column, so the results pane comes down level with the
  // buttons and no shorter.
  const leastOf = (el) => {
    const strip = el.querySelector('.wb-strip')
    const body = strip.querySelector('.wb-strip-body')
    const pad = getComputedStyle(body)
    const head = strip.querySelector('.wb-strip-head')?.getBoundingClientRect().height ?? 0
    const dock = body.querySelector('.run-foot')?.getBoundingClientRect().height ?? 0
    return Math.ceil(head + parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom) + dock + parseFloat(getComputedStyle(strip).borderTopWidth))
  }
  const size = (h) => {
    const el = rootRef.current
    if (!el) return null
    const top = el.getBoundingClientRect().top
    const least = leastOf(el)
    const next = Math.round(Math.min(Math.max(h, least), (window.innerHeight - top) * 0.78))
    setHeight(el, next)
    return next
  }
  const keep = (h) => {
    try { if (h) localStorage.setItem(WORLD_KEY, String(h)) } catch { /* storage may be off */ }
  }
  const down = (event) => {
    if (event.button > 0 || !event.isPrimary) return
    event.preventDefault()
    const el = rootRef.current
    const bottom = el.getBoundingClientRect().bottom
    const original = ['--world-h', '--world-max', '--world-start'].map((key) => [key, el.style.getPropertyValue(key)])
    let last = null
    track(event, {
      move(next) { last = size(bottom - next.clientY) },
      finish(commit) {
        if (commit) keep(last)
        else for (const [key, value] of original) el.style.setProperty(key, value)
      },
      escape: true,
    })
  }
  const fit = () => {
    rootRef.current?.style.removeProperty('--world-h')
    rootRef.current?.style.removeProperty('--world-max')
    rootRef.current?.style.removeProperty('--world-start')
    try { localStorage.removeItem(WORLD_KEY) } catch { /* storage may be off */ }
  }
  const key = (event) => {
    const step = event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0
    if (!step) return
    event.preventDefault()
    keep(size(rootRef.current.querySelector('.wb-strip').getBoundingClientRect().height + step))
  }
  return <div className="wb-resize" role="separator" aria-orientation="horizontal" aria-label={tr('拖动调整结果区高度，双击恢复自动高度')} title={tr('拖动调整高度 · 双击恢复自动高度')} tabIndex={0} onPointerDown={down} onDoubleClick={fit} onKeyDown={key} />
}
