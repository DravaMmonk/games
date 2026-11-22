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
 *              it) and, in a narrow column on the right, an optional panel (`aboveDock`) above the run bar (`dock`)
 *
 * `results` left out: the level has no results pane (the run bar alone, at the right); null: the pane is there, empty
 * until there is something to show. The strip fits its contents up to the automatic limit. A `resultsFitRef` points
 * to a result that keeps its natural height while the pane scrolls. Dragging the top edge sets a height for the
 * current visit, and double-clicking restores automatic sizing.
 */
export default function Workbench({ rootRef: given, className = '', brief, taskNav, tools, stage, scroll = false, tests, status, results, resultsFitRef, resultsTitle, resultsAside, aboveDock, dock }) {
  const own = useRef(null)
  const rootRef = given ?? own
  const pane = results !== undefined
  const hasHeader = Boolean(tests || status)
  const hasPaneHeader = Boolean(resultsTitle || resultsAside)
  const hasDock = Boolean(dock)
  const hasDockPanel = Boolean(aboveDock)
  const hasStrip = pane || hasHeader || hasDock
  const stripRef = useRef(null)
  useLayoutEffect(() => {
    if (!hasStrip) return
    const strip = stripRef.current
    const body = strip.querySelector('.wb-strip-body')
    const head = strip.querySelector('.wb-strip-head')
    const dock = strip.querySelector('.run-foot')
    const panel = strip.querySelector('.wb-above-dock')
    const content = resultsFitRef?.current
    const paneHead = content && strip.querySelector('.wb-pane-head')
    const height = (element) => element?.getBoundingClientRect().height ?? 0
    const padding = (element) => {
      const style = getComputedStyle(element)
      return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    }
    const updateSize = () => {
      const trim = padding(body) + parseFloat(getComputedStyle(strip).borderTopWidth)
      const panelRoom = panel ? parseFloat(getComputedStyle(panel).minHeight) + parseFloat(getComputedStyle(panel.parentElement).rowGap) : 0
      const outer = height(head) + trim
      strip.style.setProperty('--world-min', `${outer + height(dock) + panelRoom}px`)
      if (content) {
        const resultHeight = height(content) + padding(content.parentElement) + height(paneHead)
        strip.style.setProperty('--world-fit', `${Math.ceil(outer + resultHeight)}px`)
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    for (const element of [head, dock, content, paneHead]) if (element) observer.observe(element)
    return () => {
      observer.disconnect()
      strip.style.removeProperty('--world-fit')
    }
  }, [hasStrip, hasHeader, hasPaneHeader, hasDock, hasDockPanel, resultsFitRef])
  return (
    <div ref={rootRef} className={`level ${className}`}>
      <aside className="brief">{taskNav}{brief}</aside>
      <div className={`stage-pane ${scroll ? 'is-scroll' : 'is-board'}`}>
        {tools && <div className="wb-toolbar" aria-label={tr("工具")}>{tools}</div>}
        <div className="wb-stage">{stage}</div>
      </div>
      {hasStrip && (
        <section ref={stripRef} className="wb-strip">
          {pane && <WorldHandle />}
          {hasHeader && (
            <header className="wb-strip-head">
              <div className="wb-tests">{tests}</div>
              {status}
            </header>
          )}
          <div className="wb-strip-body">
            {pane && (
              <section className="wb-pane wb-results">
                {hasPaneHeader && <header className="wb-pane-head"><span>{resultsTitle}</span>{resultsAside}</header>}
                <div className="wb-pane-body">{results}</div>
              </section>
            )}
            {dock && <div className="wb-actions">
              {aboveDock && <div className="wb-pane wb-above-dock" tabIndex={0}>{aboveDock}</div>}
              <footer className="run-foot">{dock}</footer>
            </div>}
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

const setShare = (strip, share) => strip.style.setProperty('--world-h', `${share}cqh`)

function WorldHandle() {
  const { track } = usePointerSession()
  const handle = useRef(null)
  useLayoutEffect(() => {
    const strip = handle.current.parentElement
    return () => strip.style.removeProperty('--world-h')
  }, [])
  const size = (height) => {
    const strip = handle.current.parentElement
    const workspace = strip.parentElement.getBoundingClientRect().height
    if (!workspace) return
    setShare(strip, Math.max(0, height / workspace * 100))
    setShare(strip, strip.getBoundingClientRect().height / workspace * 100)
  }
  const down = (event) => {
    if (event.button > 0 || !event.isPrimary) return
    event.preventDefault()
    const strip = handle.current.parentElement
    const bottom = strip.getBoundingClientRect().bottom
    const original = strip.style.getPropertyValue('--world-h')
    track(event, {
      move(next) { size(bottom - next.clientY) },
      finish(commit) {
        if (!commit) strip.style.setProperty('--world-h', original)
      },
      escape: true,
    })
  }
  const fit = () => handle.current.parentElement.style.removeProperty('--world-h')
  const key = (event) => {
    const step = event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0
    if (!step) return
    event.preventDefault()
    size(handle.current.parentElement.getBoundingClientRect().height + step)
  }
  return <div ref={handle} className="wb-resize" role="separator" aria-orientation="horizontal" aria-label={tr('拖动调整结果区高度，双击恢复自动高度')} title={tr('拖动调整高度 · 双击恢复自动高度')} tabIndex={0} onPointerDown={down} onDoubleClick={fit} onKeyDown={key} />
}
