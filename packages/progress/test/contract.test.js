import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineCourse as defineCircuitCourse, usable } from 'circuit'
import { createPluginKernel } from '../../../games/kit/engine/plugins.js'
import { loadModule, closeGames } from '../../../games/kit/engine/games.mjs'
import { progressFieldsProblems } from '../../circuit/core/progress-fields.js'
import { defineCourse, progressMeaning, register } from '../core/index.js'

test('circuit offers the whole tray and progress limits it to held members', () => {
  const first = { id: 'first' }, second = { id: 'second' }
  const options = {
    levels: [first, second],
    parts: { outside: {}, early: {}, late: {} },
    primitives: ['outside', 'early', 'late'],
    adds: at => at.id === 'first' ? ['outside', 'early'] : ['late'],
    trays: { main: { items: ['late', 'early'] } },
    tray: () => 'main',
  }
  assert.deepEqual(usable(defineCircuitCourse(options), first), ['late', 'early'])
  const course = defineCourse(options)
  assert.deepEqual(usable(course, first), ['early'])
  assert.deepEqual(usable(course, second), ['late', 'early'])
})

test('progress fields name the required package and leave bench-local stages alone', () => {
  const content = {
    levels: [{ id: 'level', adds: ['part'], tasks: [{ opens: ['upgraded'], setup: { stages: [] } }] }],
    registries: {
      'circuit/part': { part: { stages: [{ id: 'upgraded' }] } },
      'circuit/tray': { tray: { workshop: false } },
    },
  }
  const problems = progressFieldsProblems(content, {})
  assert.deepEqual(problems.map(problem => problem.at), [
    'levels/level.json.adds', 'levels/level.json.tasks[0].opens', 'parts/part.json.stages', 'trays/tray.json.workshop',
  ])
  assert.ok(problems.every(problem => problem.says.includes('progress package')))
  assert.deepEqual(progressFieldsProblems(content, { meanings: [progressMeaning] }), [])
})

test('progress registers its course, unlocks and Studio extensions through paired entries', async () => {
  try {
    const kernel = createPluginKernel()
    register(kernel.forPackage('progress', 'core'))
    const view = await loadModule(new URL('../view/index.jsx', import.meta.url).pathname)
    view.register(kernel.forPackage('progress', 'view'))
    assert.equal(typeof kernel.tables.kind.get('progress/part').circuitProgress, 'function')
    assert.equal(typeof kernel.tables.unlocks.get('progress/parts'), 'function')
    assert.equal(typeof kernel.tables.editorExtension.get('progress/part').stageChain, 'function')
    assert.equal(typeof kernel.tables.editorExtension.get('progress/tray').workshop, 'function')
  } finally {
    await closeGames()
  }
})
