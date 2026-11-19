import { circuitRuntime } from 'circuit'
import { vocabulary } from './vocabulary.js'
import { tickBusWorks, prepareWorks } from './work.js'
import { entries, runLevel } from './run.js'
import { play } from './play.js'
import { fixedCards } from './cards.js'

export default circuitRuntime({
  vocabulary,
  prepare: prepareWorks,
  course: tickBusWorks,
  fixedCards,
  run: runLevel,
  entries,
  summarize: reference => `, ${reference.runs.reduce((count, run) => count + run.ticks.length, 0)} ticks`,
  failure: (r) => (r.error ? '(a loop)' : r.fail ? `at tick ${r.fail.at?.tick} (${(r.fail.at?.id ?? r.fail.at)}: want ${r.fail.want}, got ${r.fail.got})` : ''),
  play,
})
