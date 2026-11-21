import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { moduleProblems } from '../../../games/kit/engine/contract.js'
import { registry } from '../core/catalog.js'
import logicModule from '../core/module.js'
import runtime from '../core/runtime.js'

test('the logic runtime and its registered capabilities satisfy the package contract', () => {
  assert.deepEqual(moduleProblems(logicModule, registry, runtime), [])
  assert.deepEqual(Object.keys(registry.tables.board).filter(name => name.startsWith('logic/')).sort(), ['logic/gates', 'logic/machine', 'logic/proof'])
  assert.deepEqual(Object.keys(runtime.languages).sort(), ['logic/condition', 'logic/formula', 'logic/premise', 'logic/side'])
  assert.equal(registry.tables.operation['logic/append'].params.fields.ways.default, '2')
  assert.deepEqual(registry.tables.operation['logic/resolve'].params.fields.unit.values, ['any', 'unit'])
})

// A verdict is a pure function of the content, the task and the board.
const IMPURE = /\bMath\.random\b|\bDate\.now\b|\bnew Date\b|\bperformance\.now\b/
const CORE = resolve(import.meta.dirname, '../core')

test('logic core computes without a clock or an unseeded random source', () => {
  const files = readdirSync(CORE, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => resolve(entry.parentPath, entry.name))
  const impure = files.flatMap(file => readFileSync(file, 'utf8').split('\n').flatMap((line, index) =>
    IMPURE.test(line.replace(/\/\/.*$/, '')) ? [`${relative(CORE, file)}:${index + 1}`] : []))
  assert.deepEqual(impure, [])
})
