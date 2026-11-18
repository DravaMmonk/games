import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineCourse as defineCircuitCourse } from '../../core/index.js'
import { usable } from '../../core/course.js'
import { createPluginKernel } from '../../../../games/kit/engine/plugins.js'
import { loadModule, closeGames } from '../../../../games/kit/engine/games.mjs'
import { progressFieldsProblems } from '../../core/progress-fields.js'
import { register } from '../../core/index.js'
import { defineCourse } from '../../core/progression/index.js'

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

test('a tray can include unlisted parts only under a grant policy', () => {
  const content = {
    levels: [{ id: 'level', adds: ['part'], tasks: [{ opens: ['upgraded'], setup: { stages: [] } }] }],
    registries: {
      'circuit/part': { part: { stages: [{ id: 'upgraded' }] } },
      'circuit/tray': { tray: { includeUnlisted: true } },
    },
  }
  assert.deepEqual(progressFieldsProblems(content).map(problem => problem.at), ['trays/tray.json.includeUnlisted'])
  content.registries['progress/policy'] = { parts: { kind: 'circuit/part', grants: true } }
  assert.deepEqual(progressFieldsProblems(content), [])
})

test('circuit registers its progression and Studio adapters through paired entries', async () => {
  try {
    const kernel = createPluginKernel()
    register(kernel.forPackage('circuit', 'core'))
    const view = await loadModule(new URL('../../view/index.jsx', import.meta.url).pathname)
    view.register(kernel.forPackage('circuit', 'view'))
    assert.equal(typeof kernel.tables.kind.get('circuit/progression').circuitProgress, 'function')
    assert.equal(typeof kernel.tables.game.get('circuit/stages'), 'function')
    assert.equal(typeof kernel.tables.editorExtension.get('circuit/stages').stageChain, 'function')
  } finally {
    await closeGames()
  }
})
