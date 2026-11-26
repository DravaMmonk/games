import { useState } from 'react'
import { checkAction, RunDock, Verdict, L, Markup, NamedLines, PlayLayout, TestTabs, inspectWork, useCheckedWork } from 'kernel/view'
import TreeRows from './TreeRows.jsx'
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
    <div className={play.stage}>
      {resource.prompt && <p className="fo-say fo-prompt"><Markup text={resource.prompt} /></p>}
      <TreeRows {...resource.rows(work, change, `${entry.id}:${entry.source.task}`, at)} />
      {resource.lines && <NamedLines lines={resource.lines(work, L, at)} formulas />}
    </div>
  )
  const tests = resource.tabs?.length > 1 && <TestTabs tests={resource.tabs} first={first} index={at} onSelect={select} phone={phone} />
  return <PlayLayout screen={screen} play={play} tests={tests || null} stage={stage} results={results} dock={dock} />
}
