import { T } from 'kernel/words'
import { L, RowTable, RunDock, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'
import BoardStage from './BoardStage.jsx'

/** A query checked family by family, in the same check table as a declaration's cases: each row says what it expects. */
export default function LookupCheck({ screen, resource, play }) {
  const { phone } = screen
  const { work, change, history, finish } = useSavedWork(screen, {
    read: (saved) => saved?.work ?? resource.initial,
    write: (work) => ({ work }),
  })
  const { steps, lines } = resource.run(work)
  const playback = usePlayback({
    count: 1,
    stepsOf: () => steps.map((step) => (step.failed ? { ...step, failed: L(step.failed) } : step)),
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
  const toggle = (k, d) => change(work.map((picked, j) => (j !== k ? picked : picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d].sort())))
  const rows = resource.worlds.map((world, k) => ({ ...world, k }))
  const columns = [
    {
      key: 'world', label: T('情形', {}, 'world'), align: 'start',
      cell: (row) => (
        <span className="ck-family">
          <b>{L(row.title)}</b>
          {row.lines.map((line, j) => <span key={j}>{L(line.text)}{line.strong && L(line.strong)}</span>)}
        </span>
      ),
    },
    { key: 'sentence', label: T('句子', {}, 'column'), span: (k) => (k ? 0 : rows.length), cell: () => L(T('逻辑语言')) },
    {
      key: 'expected', label: T('预期结果'), align: 'start',
      cell: (row) => (
        <span className="ck-picks" role="group" aria-label={L(T('预期结果'))}>
          {row.things.map((thing) => (
            <button key={thing.value} type="button" aria-pressed={work[row.k].includes(thing.value)} onClick={() => toggle(row.k, thing.value)}>{L(thing.text)}</button>
          ))}
        </span>
      ),
    },
    {
      key: 'result', label: T('实际结果'),
      cell: (row) => (shown.list.length > row.k
        ? <span className={lines[row.k].right ? 'ck-right' : 'ck-wrong'}>{L(lines[row.k].text)}</span>
        : '—'),
    },
  ]
  const table = <div className="ck ck-world"><RowTable phone={phone} rows={rows} columns={columns} rowClass={(k) => (shown.at === k ? 'is-on' : '')} /></div>
  const stage = <BoardStage className={play.stage} say={resource.prompt} rows={resource.board} table={table} />
  const results = verdict ? <Verdict pass={passed} compact>{verdict}</Verdict> : null
  const dock = <RunDock {...playback.dock({ go: L(resource.go), done: L(resource.done) })} />
  return <PlayLayout screen={screen} play={play} stage={stage} results={results} dock={dock} />
}
