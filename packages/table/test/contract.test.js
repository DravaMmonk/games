import test from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel } from '../../../games/kit/engine/plugins.js'
import { register } from '../core/index.js'
import { modelOf } from '../core/model/run.js'
import { partsOf } from '../core/model/parts.js'
import { fitted, blank } from '../core/model/board.js'
const world = {
 outs: [['cell', 'Cell', null, 'kernel/number']],
 order: () => [0, 1], keys: (_test, cell) => ({ cell: String(cell) }), base: () => [],
 read: (_test, cell) => cell + 1, answer: (_test, table) => table.get('1'),
}
test('table core registers and deterministically runs a synthetic world without a course', () => {
 const kernel = createPluginKernel(); register(kernel.forPackage('table', 'core'))
 assert.equal(kernel.tables.kind.has('table/model'), true)
 const model = modelOf(partsOf({})), board = fitted(blank(), { offers: { view: ['input'], facts: [] }, outs: ['cell'] })
 board.nodes.find(node => node.id === 'view').params = { picks: ['input'] }
 board.wires.push({ from: 'view#input', to: 'cell', port: 'in' })
 const report = model.runCircuit(world, {}, board, { traced: true })
 assert.equal(report.value, 2)
 assert.deepEqual(model.runCircuit(world, {}, board, { traced: true }), report)
 assert.equal(report.steps.length, 2)
})
