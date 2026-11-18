import { qualifyItems } from 'kernel'
// The scenes a circuit level's tests are set in (vocabulary.js scene): what a test gives the circuit and what it
// expects back, from the few numbers the test writes. A level names its scene and may set it up (`setup`); each test
// writes its label and the scene's own fields (`train: false` keeps it out of training: a new sample the training is
// checked on). Each scene is
//
//   { about, setup?: schema of the level's setup, test: schema of a test's fields, make(test, setup, level) →
//     { inputs: { name: picture }, expected: { name: picture } } }
//
// with the level's inputs and outputs named as the level names them (level.inputs, level.outputs).

import { picture } from '../pictures.js'
import { targetOf } from '../targets.js'

const pictures = (calls) => Object.fromEntries(Object.entries(calls).map(([name, call]) => [name, picture(call)]))
const FILTER = {
  filter: {
    make: (test, { target, given = {} }, level) => {
      const own = test.inputs ? pictures(test.inputs) : { [level.inputs[0]]: picture(test.in) }
      const args = level.inputs.filter((name) => name in own).map((name) => own[name])
      return { inputs: { ...own, ...pictures(given) }, expected: { [level.outputs[0]]: targetOf(target)(...args) } }
    },
  },
}

const GROUPS = [FILTER]
export const SCENES = qualifyItems('image', Object.fromEntries(GROUPS.flatMap((group) => Object.entries(group))))
for (const name of GROUPS.flatMap((group) => Object.keys(group))) if (GROUPS.filter((group) => name in group).length > 1) throw new Error(`two scenes are called ${name}`)

/** A level's (or a task's) tests, as the level runs take them: [{ label, inputs, expected, train? }]. */
export function testsOf(level, list = [], scenes = SCENES) {
  const scene = scenes[level.scene]
  return list.map(({ label, train, ...fields }) => ({ label, ...scene.make(fields, level.setup ?? {}, level), ...(train === undefined ? {} : { train }) }))
}
