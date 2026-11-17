import { useState } from 'react'
import { checkAction } from '../useCheckOnce.js'
import RunDock from '../RunDock.jsx'
import Verdict from '../Verdict.jsx'
import { L } from '../i18n.js'
import NamedLines from '../NamedLines.jsx'
import PlayLayout from './PlayLayout.jsx'
import TestTabs from '../TestTabs.jsx'
import TreeRows from './TreeRows.jsx'
import { inspectWork, useCheckedWork } from './useWork.js'

// `resource.tabs` (optional): the same rows read in other words — a level's cases, then its letters — as tabs that only
// change how the rows read; rows, lines and the judge's words take the tab (`at`).
export default function Rows({ screen, resource, play }) {
  const { level: entry, phone } = screen
  const [at, select] = useState(0)
  const { work, verdict, check, change } = useCheckedWork(screen, { read: resource.initial, write: resource.keep }, inspectWork(play, (rows) => resource.judge(rows, at)), resource.score)
  const results = verdict && <Verdict pass={verdict.pass} failure={verdict.failure}>{L(resource.passed)}</Verdict>
  const dock = <RunDock go={checkAction(check, Boolean(verdict?.pass))} />
  const stage = (
    <div className={play.stage}>
      <TreeRows {...resource.rows(work, change, `${entry.id}:${entry.source.task}`, at)} />
      {resource.lines && <NamedLines lines={resource.lines(work, L, at)} />}
    </div>
  )
  const tests = resource.tabs?.length > 1 && <TestTabs tests={resource.tabs} index={at} onSelect={select} phone={phone} />
  return <PlayLayout screen={screen} play={play} tests={tests || null} stage={stage} results={results} dock={dock} />
}
