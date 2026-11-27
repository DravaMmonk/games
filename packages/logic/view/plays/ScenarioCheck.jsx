import { useMemo } from 'react'
import { worldEdits } from '../../core/worldValues.js'
import WorldGraph from '../ui/WorldGraph.jsx'
import BoardStage from './BoardStage.jsx'
import { L, RunDock, Verdict, usePlayback, PlayLayout, useSavedWork } from 'kernel/view'

/**
 * Build one world and play the board's sentences in it. The world is drawn and built in place under the sentences, and
 * each quantified sentence lists its instances in that world as it is built; a run reads each sentence a quantifier
 * step at a time (the instance it reads lit, the things and facts it reads lit in the world, each instance's truth put
 * beside it) and then puts the sentence's truth beside it.
 */
export default function ScenarioCheck({ screen, resource, play }) {
  const { work, change, history, finish } = useSavedWork(screen, {
    read: (saved) => saved?.work ?? resource.initial,
    write: (work) => ({ work }),
  })
  const world = resource.valid(work) ? work : resource.initial
  const { steps, results: found, cases } = useMemo(() => resource.run(world), [resource, world])
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
  // What the run has read of each instance so far: its truth, by sentence and instance.
  const read = new Map(shown.list.filter((step) => step.case >= 0).map((step) => [`${step.sentence}.${step.case}`, step.value]))

  // Each sentence's slot: lit while the run reads it, its truth beside it once read.
  const rows = resource.board.rows.map((row, r) => ({
    ...row,
    slots: row.slots.map((slot, j) => {
      const k = found.findIndex(({ at }) => at[0] === r && at[1] === j)
      if (k < 0) return slot
      const listed = (cases[k] ?? []).map((c, j) => ({
        text: c.text,
        on: current?.sentence === k && current.case === j,
        result: read.has(`${k}.${j}`) ? { text: read.get(`${k}.${j}`) } : null,
      }))
      return { ...slot, on: current?.sentence === k && !current.done, result: done.has(k) ? found[k] : null, cases: listed }
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
