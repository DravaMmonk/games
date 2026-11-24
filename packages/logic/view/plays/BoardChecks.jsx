import { useState } from 'react'
import Checks from './Checks.jsx'
import { L, NamedLines, RunDock, TestTabs, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'
import TreeRows from './TreeRows.jsx'
import { usePreferredTest } from '../general-form.js'

/** Inspect given works and write cases that check how they behave. */
export default function BoardChecks({ screen, resource, play }) {
  const { phone } = screen
  const [row, setRow] = useState(0)
  const [selected, select] = useState(null)
  const { tabs, initial, judge, stepsOf } = resource
  const first = usePreferredTest(tabs)
  const at = selected ?? first ?? 0
  // The case table's fields, in the words of the tab on view when a work reads its tabs in other words.
  const { resultLabel, ...fields } = typeof resource.checks === 'function' ? resource.checks(at) : resource.checks
  const { work, change, history, finish } = useSavedWork(screen, {
    read: () => initial,
    write: (work) => ({ work }),
  })
  const playback = usePlayback({
    count: tabs.length,
    stepsOf: (k) => stepsOf(k, work),
    check: (k) => L(judge(k, work) ?? ''),
    onSolve: () => finish(resource.completion(work)),
    onTest: (k, restored) => { if (!restored || first === undefined) select(k) },
    board: work,
    kept: history.lastRun,
    onKeep: history.keepRun,
  })
  const { run, passed, states } = playback
  const result = resource.result(work, at, playback.shown(at).list.length)
  const text = run?.over ? passed ? L(resource.passed(work)) : run.results.at(-1)?.reason : null
  const stage = (
    <div className={play.stage}>
      <TreeRows {...resource.rows(at)} />
      <NamedLines lines={resource.lines(at, L)} formulas />
      <Checks
        {...fields} phone={phone} rows={work} onChange={change} onPick={setRow}
        rowClass={(k) => k === row ? 'is-on' : ''}
        result={{ label: resultLabel, at: result }}
      />
    </div>
  )
  const tests = play.checks === 'shown' && <TestTabs tests={tabs} states={states} first={first} index={at} onSelect={select} phone={phone} />
  const dock = <RunDock {...playback.dock({ go: L(resource.go), done: L(resource.done) })} />
  return <PlayLayout screen={screen} play={play} tests={tests} stage={stage} results={text ? <Verdict pass={passed}>{text}</Verdict> : null} dock={dock} />
}
