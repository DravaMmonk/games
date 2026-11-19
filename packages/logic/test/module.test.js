import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCapabilityRegistry } from '../../../games/kit/engine/capabilities.js'
import logic from '../core/module.js'
import { OPS } from '../core/ops.js'

test('logic registers its boards, languages and typed executable operations', () => {
  const registry = createCapabilityRegistry()
  logic.register(registry)
  assert.deepEqual(Object.keys(registry.tables.board).filter(name => name.startsWith('logic/')).sort(), ['logic/gates', 'logic/machine', 'logic/proof'])
  assert.deepEqual(Object.keys(registry.tables.language).sort(), ['logic/condition', 'logic/formula', 'logic/side'])
  for (const [name, operation] of Object.entries(registry.tables.operation).filter(([name]) => name.startsWith('logic/'))) {
    assert.equal(typeof OPS[name].run, 'function', name)
    assert.ok(registry.tables.valueType[operation.returns], name)
    for (const input of operation.args) assert.ok(registry.tables.valueType[input.type], `${name}.${input.name}`)
    assert.equal(operation.params.type, 'obj', name)
  }
  assert.equal(registry.tables.operation['logic/append'].params.fields.ways.default, '2')
  assert.deepEqual(registry.tables.operation['logic/resolve'].params.fields.unit.values, ['any', 'unit'])
})

test('built logic parts retain their wire types and evaluate the saved machine work', async () => {
  const { lemma } = await import('../core/proof.js')
  const { builtGates } = await import('../core/gates.js')
  const { builtMachine } = await import('../core/machine.js')
  const { sink, source } = await import('circuit')
  const proof = lemma({ statement: 'B', premises: ['A', 'A → B'], metas: ['A', 'B'] })
  assert.deepEqual(proof.inputTypes, { p0: 'logic/judgment', p1: 'logic/judgment' })
  assert.equal(proof.outputType, 'logic/judgment')
  const gates = builtGates({ own: { ports: ['a', 'b'] } }, { own: { taskId: 'builder', target: 'A ∧ B' } }, () => null)
  assert.deepEqual(gates.own.inputTypes, { a: 'kernel/boolean', b: 'kernel/boolean' })
  assert.equal(gates.own.outputType, 'kernel/boolean')
  const reference = {
    nodes: [{ id: 'in', type: 'in', params: { name: 'in' } }, { id: 'out', type: 'out', params: { name: 'out' } }],
    wires: [{ from: 'in', to: 'out', port: 'in' }],
  }
  const builder = { taskId: 'builder', partSolution: reference }
  const saved = {}
  const machine = builtMachine('own', () => builder, { inputs: [{ name: 'in' }, { name: 'rules' }] }, key => saved[key])
  assert.deepEqual(machine.inputTypes, { in: 'logic/machine-value', rules: 'logic/machine-value' })
  assert.equal(machine.outputType, 'logic/machine-value')
  const node = { id: 'packed', params: {} }
  const context = { engine: { parts: { in: source(), out: sink() } } }
  assert.equal(machine.eval({ in: 42 }, node, context), 42)
  saved.builder = { ...reference, wires: [] }
  assert.throws(() => machine.eval({ in: 42 }, node, context), /Cannot compute/)
  delete saved.builder
  assert.equal(machine.eval({ in: 42 }, node, context), 42)
})
