import { moduleProblems } from '../../../games/kit/engine/contract.js'
import { register as registerScalar } from '../../numlib/core/index.js'
import { register } from '../core/index.js'
import { createPluginKernel } from '../../../games/kit/engine/plugins.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vocabulary } from '../../../games/kit/engine/kernel.js'
import { createCapabilityRegistry } from '../../../games/kit/engine/capabilities.js'
import { typeProblems } from '../core/parts/types.js'
import { S } from '../../../games/kit/engine/schema.js'
import { parse, print } from '../core/parts/expr.js'

test('each kind rejects duplicate names and permits a name shared across kinds', () => {
  const registry = createCapabilityRegistry()
  registry.add('valueType', 'toy/number', { about: 'number' })
  registry.add('operation', 'toy/number', { about: 'number' })
  assert.throws(() => registry.add('valueType', 'toy/number', {}), /duplicate/)
  assert.throws(() => registry.add('operation', 'plain', {}), /invalid capability name/)
  assert.equal(vocabulary.version, undefined)
})

test('qualified operation names round-trip beside match case delimiters', () => {
  const expression = "match $op { add: numlib/add(a, b), _: image/gauss(a, 1, 'crop') }"
  assert.equal(print(parse(expression)), expression)
})

test('types check nested operations, branches and outputs across modules', () => {
  const vocabulary = { kinds: {
    valueType: { 'toy/number': {}, 'toy/image': {} },
    operation: {
      'math/add': { args: [{ name: 'a', type: 'toy/number' }, { name: 'b', type: 'toy/number' }], returns: 'toy/number', params: S.obj({}) },
      'picture/blur': { args: [{ name: 'a', type: 'toy/image' }], returns: 'toy/image', params: S.obj({}) },
    },
  } }
  const part = { inputs: [{ name: 'a', type: 'toy/number' }], outputType: 'toy/number', op: 'math/add' }
  assert.deepEqual(typeProblems({ parts: { sample: part } }, vocabulary), [])
  assert.match(typeProblems({ parts: { sample: { ...part, outputType: 'toy/image', op: 'picture/blur' } } }, vocabulary)[0].says, /input types/)
  assert.match(typeProblems({ parts: { sample: { ...part, outputType: 'toy/image' } } }, vocabulary)[0].says, /output type/)
})

test('named parameters are checked using their declared value type', () => {
  const schema = { kinds: { valueType: { 'kernel/number': {} }, operation: {
    'toy/scale': { args: [{ name: 'a', type: 'kernel/number' }], returns: 'kernel/number', params: S.obj({ label: S.str() }) },
  } } }
  const file = { parts: { sample: {
    inputs: [{ name: 'a', type: 'kernel/number' }], outputType: 'kernel/number', settings: { 'label': { control: 'number', default: 1 } }, op: 'toy/scale',
  } } }
  assert.match(typeProblems(file, schema)[0].says, /parameter label/)
})

test('module contracts reject missing implementations and incomplete signatures', () => {
  const registry = createCapabilityRegistry()
  registry.add('operation', 'toy/empty', { about: 'Empty', signatures: [] })
  registry.add('operation', 'toy/missing', { about: 'Missing' })
  const problems = moduleProblems({ id: 'toy', register() {} }, registry)
  assert.ok(problems.some((problem) => problem.includes('no runtime implementation')))
  assert.ok(problems.some((problem) => problem.includes('no signatures')))
  assert.ok(problems.some((problem) => problem.includes('no argument signature')))
  assert.ok(problems.some((problem) => problem.includes('no parameter declaration')))
})

test('operations from another module execute through the normal part compiler', async () => {
  const kernel = createPluginKernel()
  register(kernel.forPackage('circuit', 'core'))
  registerScalar(kernel.forPackage('numlib', 'core'))
  const { defineParts } = await import('../core/parts/define.js')
  const { PARTS } = defineParts({ parts: { sample: {
    inputs: [{ name: 'a', type: 'kernel/number' }], outputType: 'kernel/number', op: 'numlib/add',
  } } }, {})
  assert.equal(PARTS.sample.eval({ a: 3, b: 3 }, {}), 6)
})

test('circuit evaluation rejects an incompatible typed wire', async () => {
  const { evaluate } = await import('../core/circuit.js')
  const graph = { nodes: [{ id: 'source', type: 'source' }, { id: 'target', type: 'target' }], wires: [{ from: 'source', to: 'target', port: 'a' }] }
  const parts = {
    source: { inputs: [], outputType: 'kernel/boolean', eval: () => true },
    target: { inputs: ['a'], inputTypes: { a: 'kernel/number' }, outputType: 'kernel/number', eval: ({ a }) => a },
  }
  assert.match(evaluate(graph, { parts }).errors.get('target'), /expects kernel\/number, received kernel\/boolean/)
})


test('module contracts require a display implementation owned by that module', () => {
  const registry = createCapabilityRegistry()
  registry.add('display', 'toy/hero', { about: 'Map illustration', role: 'hero' })
  assert.ok(moduleProblems({ id: 'toy', register() {} }, registry).some((problem) => problem.includes('no display implementation')))
  registry.definitions.display = { implementation: { side: 'view' } }
  assert.throws(() => registry.implement('display', 'toy/hero', 'other/view', 'view'), /package view entry/)
  registry.implement('display', 'toy/hero', 'toy/view', 'view')
  assert.ok(!moduleProblems({ id: 'toy', register() {} }, registry).some(problem => problem.includes('implementation')))
})
