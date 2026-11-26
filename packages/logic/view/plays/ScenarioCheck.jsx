import { useMemo } from 'react'
import { worldEdits } from '../../core/worldValues.js'
import WorldGraph from '../ui/WorldGraph.jsx'
import BoardStage from './BoardStage.jsx'
import { L, RunDock, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'

/**
 * Build one world and play the board's sentences in it. The world is drawn and built in place under the sentences;
 * a run reads each sentence in the world a quantifier step at a time (the things its variables stand for and the
 * facts it reads light up in the world) and then puts its truth beside it.
 */
export default function ScenarioCheck({ screen, resource, play }) {
  const { work, change, history, finish } = useSavedWork(screen, {
    read: (saved) => saved?.work ?? resource.initial,
    write: (work) => ({ work }),
  })
  const world = resource.valid(work) ? work : resource.initial
  const { steps, results: found } = useMemo(() => resource.run(world), [resource, world])
  const playback = usePlayback({
    count: 1,
    stepsOf: () => steps.map((step) => step.failed ? { ...step, failed: L(step.failed) } : step),
    check: () => '',
    onSolve: () => finish(null),
    board: world,
    kept: history.lastRun,
    onKeep: history.keepRun,
  })
  const { run, passed } = playback
  const shown = playback.shown(0)
  const failed = run?.over && !passed ? run.results.at(-1)?.reason : null
  const verdict = passed ? L(resource.passed) : failed
  const current = shown.at >= 0 ? shown.list[shown.at] : null
  const done = new Set(shown.list.filter((step) => step.done).map((step) => step.sentence))

  // Each sentence's slot: lit while the run reads it, its truth beside it once read.
  const rows = resource.board.rows.map((row, r) => ({
    ...row,
    slots: row.slots.map((slot, j) => {
      const k = found.findIndex(({ at }) => at[0] === r && at[1] === j)
      if (k < 0) return slot
      return { ...slot, on: current?.sentence === k && !current.done, result: done.has(k) ? found[k] : null }
    }),
  }))
  const edit = {
    resize: (size) => change(worldEdits.resize(world, size)),
    toggle: (p, key) => change(worldEdits.toggle(world, p, key)),
    flip: (p) => change(worldEdits.flip(world, p)),
    place: (c, k) => change(worldEdits.place(world, c, k)),
  }
  const graph = <WorldGraph world={world} parts={resource.parts} edit={edit} frame={current?.frame ?? null} />
  const stage = <BoardStage className={play.stage} say={resource.prompt} rows={{ ...resource.board, rows }} workspace={graph} />
  const results = verdict ? <Verdict pass={passed} compact>{verdict}</Verdict> : null
  const dock = <RunDock {...playback.dock({ go: L(resource.go), done: L(resource.done) })} />
  return <PlayLayout screen={screen} play={play} stage={stage} results={results} dock={dock} />
}
