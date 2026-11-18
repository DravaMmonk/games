import { PICTURES } from './items/pictures.js'
import { TARGETS } from './items/targets.js'
import { CONSTRAINTS } from './items/constraints.js'
import valueTypesSource from '../capabilities/valueType.json' with { type: 'json' }
import { SCENES } from './items/scenes/index.js'
import { BENCH_MODELS } from './items/benches.js'
import { startValues, benchRun } from './bench.js'
/** Standard picture calls, tiles and patterns for concrete scene generators. */
export { GLYPHS, patterns } from './items/patterns.js'
export { TILES, picture } from './items/pictures.js'

import { registeredOperations, registeredValueTypes, withHidden, taskModule } from 'kernel'
import { IMAGE_OPS } from './engine/definitions.js'
import { meaning } from './catalog.js'
import runtime from './runtime.js'
import { imageContext } from './context.js'
import { imageBoards } from './engine/board-view.js'
import { startBoard } from './engine/board.js'
import { play } from './play.js'

import { readCopy } from 'kernel/words'

const valueTypes = readCopy(valueTypesSource)

const graphPlay = {
  initial(context) { return startBoard(imageContext(context).task) },
  read(work, context) { const { task, works } = imageContext(context); return Array.isArray(work) ? works.kit.fromText(work, task) : work },
  write: work => work,
  normalize: work => work,
  run(work, context) { const { task, works } = imageContext(context); return works.kit.runLevel(withHidden(task), work) },
  judge: report => ({ pass: report.pass, score: report.score }),
  runtime,
}
const benchPlay = {
  initial(context) { return startValues(imageContext(context).task.bench) },
  read: work => work, write: work => work, normalize: work => work,
  run(work, context) { const { task } = imageContext(context); return benchRun(task.bench, task.model, work) },
  judge: report => ({ pass: report.pass, score: report.pass ? 1 : 0 }), runtime,
}
const probePlay = {
  initial: () => null,
  read: work => work, write: work => work, normalize: work => work,
  run(work, context) { const { task } = imageContext(context); return { pass: task.probe.judge(work) } },
  judge: report => ({ pass: report.pass, score: report.pass ? 1 : 0 }), runtime,
}
export function register(kernel) {
  Object.assign(registeredOperations, IMAGE_OPS)
  for (const [name, item] of Object.entries(IMAGE_OPS)) kernel.implement('operation', name, item)
  registeredValueTypes['image/image'] = valueTypes.items.image
  for (const [kind, implementations] of Object.entries({ picture: PICTURES, target: TARGETS, constraint: CONSTRAINTS, 'image/scene': SCENES, benchModel: BENCH_MODELS })) {
    for (const [name, value] of Object.entries(implementations)) kernel.implement(kind, name, value)
  }
  kernel.kind('image/level', meaning)
  kernel.play('image/graph', graphPlay)
  kernel.play('image/board', benchPlay)
  kernel.play('image/probe', probePlay)
  kernel.check('image/levels', ({ content }) => content.levels.some(level => level.tasks.some(task => taskModule(task) === 'image')) ? runtime.validate(runtime.spec(content)) : [])
  for (const name of ['image/graph', 'image/board', 'image/probe']) kernel.agent(name, {
    observe: context => play.open(textContext(context)),
    act: (context, work) => play.attempt(textContext(context), work),
  })
}
function textContext(context) {
  const { task, works } = imageContext(context)
  return { game: { image: works, circuit: imageBoards(works), parts: { all: Object.entries(works.kit.types).map(([type, spec]) => ({ key: `part:${type}`, part: type, name: spec.label, desc: spec.desc })) } }, level: { ...task, source: task }, flags: context.flags ?? new Set(context.progress?.flags ?? []), progress: context.progress ?? {} }
}

/** Run and score parameter benches, and inspect the settings a concrete model can vary. */
export { startValues, openKnobs, judge, benchRun, passingSettings, limitOf } from './bench.js'
