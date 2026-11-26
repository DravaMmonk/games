import { useMemo } from 'react'
import { CheckScenario } from './Checks.jsx'
import { Formula } from '../ui/Formula.jsx'
import { translationStatements } from '../ui/translation.js'
import { T } from 'kernel/words'
import { L, Markup, RowTable, RuleRows, RunDock, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'

function worldColumns(inference, shown) {
  return [
    { key: 'name', label: T('检查项'), align: 'start', cell: (row) => L(row.name) },
    inference
      ? { key: 'expected', label: T('预期'), cell: (row) => L(row.expected) }
      : { key: 'formula', label: T('公式'), align: 'start', cell: (row) => <Formula text={row.formula} /> },
    { key: 'result', label: T('真值'), cell: (row) => shown > row.step
      ? <span className={row.right === undefined ? undefined : row.right ? 'ck-right' : 'ck-wrong'}>{L(row.text)}</span>
      : '—' },
  ]
}

/** Write a scenario, then play it against the given works. */
export default function ScenarioCheck({ screen, resource, play }) {
  const { work, change, history, finish } = useSavedWork(screen, {
    read: (saved) => saved?.work ?? resource.initial,
    write: (work) => ({ work }),
  })
  const { steps, lines } = useMemo(() => resource.run(work), [resource, work])
  const playback = usePlayback({
    count: 1,
    stepsOf: () => steps.map((step) => step.failed ? { ...step, failed: L(step.failed) } : step),
    check: () => '',
    onSolve: () => finish(null),
    board: work,
    kept: history.lastRun,
    onKeep: history.keepRun,
  })
  const { run, passed } = playback
  const shown = playback.shown(0)
  const failed = run?.over && !passed ? run.results.at(-1)?.reason : null
  const verdict = passed ? L(resource.passed) : failed
  const stage = (
    <div className={play.stage}>
      {resource.prompt && <p className="fo-say fo-prompt"><Markup text={resource.prompt} /></p>}
      {resource.board && <RuleRows {...resource.board} />}
      <CheckScenario fields={resource.fields(work, change)} />
      <div className="ck ck-world">
        <RowTable rows={lines} columns={worldColumns(resource.board, shown.list.length)}
          rowClass={(k) => shown.at === lines[k].step ? 'is-on' : ''} />
      </div>
    </div>
  )
  const results = verdict ? <Verdict pass={passed} compact>{verdict}</Verdict> : null
  const dock = <RunDock {...playback.dock({ go: L(resource.go), done: L(resource.done) })} />
  return <PlayLayout screen={screen} play={play} stage={stage} results={results} dock={dock}
    statements={translationStatements(screen.level.source, screen.progress)} />
}
