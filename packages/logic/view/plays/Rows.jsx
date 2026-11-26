import { useState } from 'react'
import { checkAction, RunDock, Verdict, L, PlayLayout, TestTabs, inspectWork, useCheckedWork } from 'kernel/view'
import BoardStage from './BoardStage.jsx'
import { usePreferredTest } from '../general-form.js'

// `resource.tabs` (optional): the same rows read in other words — a level's cases, then its letters — as tabs that only
// change how the rows read; rows, lines and the judge's words take the tab (`at`).
export default function Rows({ screen, resource, play }) {
  const { level: entry, phone } = screen
  const [selected, select] = useState(null)
  const first = usePreferredTest(resource.tabs)
  const at = selected ?? first ?? 0
  const { work, verdict, check, change } = useCheckedWork(screen, { read: resource.initial, write: resource.keep }, inspectWork(play, (rows) => resource.judge(rows, at)), resource.completion)
  const results = verdict && <Verdict pass={verdict.pass} failure={verdict.failure}>{L(resource.passed)}</Verdict>
  const dock = <RunDock go={checkAction(check, Boolean(verdict?.pass))} />
  const stage = (
    <BoardStage className={play.stage} say={resource.prompt} rows={resource.rows(work, change, `${entry.id}:${entry.source.task}`, at)} lines={resource.lines && resource.lines(work, L, at)} />
  )
  const tests = resource.tabs?.length > 1 && <TestTabs tests={resource.tabs} first={first} index={at} onSelect={select} phone={phone} />
  return <PlayLayout screen={screen} play={play} tests={tests || null} stage={stage} results={results} dock={dock} />
}
