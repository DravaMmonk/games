import { useMemo, useState } from 'react'
import { CheckScenario } from './Checks.jsx'
import BoardStage from './BoardStage.jsx'
import { T } from 'kernel/words'
import { L, Popover, RowTable, RunDock, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'

// A world in short: each setting with what is picked in it (东西的数目：2, …是人：①).
function WorldSummary({ fields }) {
  return (
    <span className="ck-world-summary">
      {fields.map((field, k) => {
        const on = (field.grid?.flat() ?? field.cells).filter((cell) => cell.on).map((cell) => L(cell.text))
        return <span key={k}>{L(field.name)}：{on.length ? on.join(' ') : '—'}</span>
      })}
    </span>
  )
}

/** Build one world and play the board's sentences in it, in the same check table as a declaration's cases. */
export default function ScenarioCheck({ screen, resource, play }) {
  const { phone } = screen
  const [anchor, setAnchor] = useState(null) // the world's cell, while its settings are open
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
  const fields = resource.fields(work, change)
  const rows = lines.length ? lines : [{ name: null }]
  const columns = [
    {
      key: 'world', label: T('情形', {}, 'world'), align: 'start', span: (k) => (k ? 0 : rows.length),
      cell: () => (
        <button type="button" className="ck-world-cell" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)}>
          <WorldSummary fields={fields} />
        </button>
      ),
    },
    // A sentence by its name: the board's rows above say it in full.
    { key: 'sentence', label: T('句子', {}, 'column'), align: 'start', cell: (row) => L(row.name) },
    { key: 'expected', label: T('预期结果'), span: (k) => (resource.compare ? (k ? 0 : rows.length) : 1), cell: (row) => L(row.expected) ?? '—' },
    { key: 'result', label: T('实际结果'), cell: (row) => row.name && shown.list.length > row.step
      ? <span className={row.right === undefined ? undefined : row.right ? 'ck-right' : 'ck-wrong'}>{L(row.text)}</span>
      : '—' },
  ]
  const table = (
    <div className="ck ck-world">
      <RowTable phone={phone} rows={rows} columns={columns} rowClass={(k) => shown.at === rows[k].step ? 'is-on' : ''} />
      {anchor && <Popover anchor={anchor} title={L(T('情形', {}, 'world'))} onClose={() => setAnchor(null)}><CheckScenario fields={fields} /></Popover>}
    </div>
  )
  const stage = <BoardStage className={play.stage} say={resource.prompt} rows={resource.board} table={table} />
  const results = verdict ? <Verdict pass={passed} compact>{verdict}</Verdict> : null
  const dock = <RunDock {...playback.dock({ go: L(resource.go), done: L(resource.done) })} />
  return <PlayLayout screen={screen} play={play} stage={stage} results={results} dock={dock} />
}
