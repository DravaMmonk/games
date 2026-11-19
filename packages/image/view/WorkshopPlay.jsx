import Bench from './bench/Bench.jsx'
import GridProbe from './GridProbe.jsx'
import { Brief, Level, PinnedPlay, TaskNavigation } from 'kernel/view'

const exercises = {
  parameters: Bench,
  gridProbe: GridProbe,
}

/** A focused exercise with a shared layout and one completion event. */
export default function WorkshopPlay({ screen, resource, play }) {
  const { game, level, phone, solve, theme } = screen
  const Exercise = exercises[play.judge]
  const brief = <Brief game={game} level={level} hint={level.hint} sections={play.taskBoard} />
  const stage = <Exercise resource={resource} onSolve={() => solve(null)} theme={theme} />
  return <Level phone={phone} className={play.layout} brief={brief} taskNav={<TaskNavigation level={level} />} stage={phone && play.pinOnPhone ? <PinnedPlay>{stage}</PinnedPlay> : stage} />
}
