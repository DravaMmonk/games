import { BUILTINS as circuitOperations } from './parts/builtins.js'
import { PRIMITIVE_TAG } from './primitive-parts.js'
import { circuitVocabulary } from './content-meaning.js'
import circuitRuntime from './mechanism/runtime.js'
import { partMeaning, trayMeaning } from './content-meaning.js'
import { boardPlay, boardChecks } from './board-play.js'
import { progressMeaning } from './progression/index.js'
import { courseChecks, referenceChecks } from './progression/content-checks.js'

export function register(kernel) {
  // Install operations before any consumer compiles its part definitions.
  circuitVocabulary({ kinds: {}, capabilities: {}, game: { fields: {} } })
  for (const [name, item] of Object.entries(circuitOperations)) kernel.implement('operation', name, item)
  kernel.reference('part')
  kernel.tag(PRIMITIVE_TAG, 'circuit/part')
  kernel.kind('circuit/part', partMeaning)
  kernel.kind('circuit/tray', trayMeaning)
  kernel.kind('circuit/progression', progressMeaning)
  kernel.check('circuit/course', Object.assign(courseChecks, { phase: 'course' }))
  kernel.check('circuit/progress-references', Object.assign(referenceChecks, { phase: 'references' }))
  kernel.play('circuit/board', { ...boardPlay, runtime: circuitRuntime })
  kernel.check('circuit/boards', boardChecks)
  kernel.agent('circuit/board', {
    observe: ({ task }) => ({ brief: task.brief, inputs: task.inputs, outputs: task.outputs }),
    act: (context, work) => {
      const prepared = boardPlay.prepareContext(context)
      const graph = boardPlay.read(work, prepared)
      return { work: graph, verdict: boardPlay.judge(boardPlay.run(graph, prepared)) }
    },
  })
}

/** Component definitions, operations and parameter descriptors for plays that build their own cards. */
export { defaultOf, defineParts, partProblems, applyRules, shows, compileParts } from './parts/define.js'
export { partDefinition } from './part-definition.js'
export { operationPart, operationsOf } from './parts/operation.js'
export { builtParts, publications, registerParts, cardOf, partReferences, settingsOf, resolveSettings } from './parts.js'
export { parameterSetting, resolveSettings as settingsResolveSettings, settingParameters } from './parts/settings.js'

/** Course inventory, publications and task work for plays sharing the component workshop. */
export { trayParts, met, reach, offer, holds, defineCourse, fresh, introductions, isCore } from './course.js'
export { trayMembers, partNames } from './trays.js'
export { readWorks, publicationEvents } from './course-model.js'
export { keptBoards } from './kept-boards.js'
export { circuitRuntime } from './circuit-preset.js'
export { preparePartsWorks } from './board-works.js'
export { inheritedBoard, passedWork, earnedUnlocks } from './progress.js'

/** Board work, fixed terminals and scoped regions for composite circuit plays. */
export { workView, workExtension, withWorkExtension, workNodes } from './board/work-extension.js'
export { circuitBoard, fixedCardsFit, primitivesOnly, OUTPUTS, INPUTS } from './board-cards.js'
export { boardView, fitsCircuit, previousCircuitTask } from './board-view.js'
export { packedBoards } from './board/packed-boards.js'
export { frameTree, regionAddress } from './board/regions.js'
export { withPreset, presetCardIds, presetOf } from './board/presets.js'
export { boardShape } from './board-shape.js'
export { VIRTUAL_INPUT, VIRTUAL_OUTPUT } from './board/virtual-terminals.js'

/** Blueprint codecs and port checks for adapters with their own node and sensor types. */
export { parse as textParse, printLines, readLines } from './board/text.js'
export { srcNode, sourceOf, wireEdges, splitSource } from './wire-source.js'
export { boardFits, wirePortRefusal, isCircuitBoard, placement, feeding } from './board/model.js'
export { sensor } from './board/sensors.js'
export { columnDepths } from './board/layout.js'

/** Circuit evaluation and traces for typed plays and packed subcircuits. */
export { withBoardRuntime, packed, runBoard, sink, source } from './boards.js'
export { Halt, MISSING, evaluate, portsOf } from './circuit.js'
export { paramsOf, formOf, formed } from './forms.js'
export { insideAt } from './trace.js'
export { tableAt, MAX_ROUNDS, walk } from './machine.js'

/** Shared circuit play contracts and baseline observations. */
export { default as module } from './mechanism/module.js'
export { circuitPlay, definedSettings, untilFail } from './play.js'
export { circuitPlaySchema } from './play-schema.js'
export { createTaskContext } from './task-context.js'
export { createBoardPlay } from './board-play.js'
export { circuitReports } from './baseline.js'
export { outputReason } from './circuit-run.js'
