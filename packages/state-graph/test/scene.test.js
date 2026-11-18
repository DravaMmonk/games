import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S, registerPlugins } from 'kernel'
import { taskStamps } from '../../../games/kit/engine/stamp.js'
import { register } from '../core/index.js'
import { expandScene } from '../../table/core/model/robot-scene.js'

test('compact and positioned intro cells produce the same saved task stamp', async () => {
  const positioned = { id: 'label', x: 0, y: -20, w: 10, h: 10, value: 'label' }
  const full = {
    cells: [
      positioned,
      { id: '0,0', x: 0, y: 0, w: 10, h: 10, cls: 'px' },
      { id: 'last', x: 18, y: 18, w: 10, h: 10, value: 1 },
    ],
    edges: [],
  }
  const compact = {
    grid: {
      w: 10, h: 10, dx: 18, dy: 18,
      palette: { p: { cls: 'px' } },
      rows: ['p ', [' ', { id: 'last', value: 1 }]],
    },
    cells: [positioned],
    edges: [],
  }
  assert.deepEqual(expandScene(compact), full)

  const kernel = await registerPlugins([{ id: 'state-graph', core: { register } }])
  const vocabulary = {
    meanings: [...kernel.tables.kind.values()],
    level: S.obj({ intro: S.any({ section: 'puzzle' }), tasks: S.list(S.obj({ id: S.task() })) }),
  }
  const stamps = scene => taskStamps(vocabulary, { levels: [{
    id: 'level', intro: [{ fig: { 'state-graph/scene': scene } }], tasks: [{ id: 'task' }],
  }] })
  assert.deepEqual(stamps(compact), stamps(full))
  assert.notDeepEqual(stamps({ ...compact, grid: { ...compact.grid, dx: 19 } }), stamps(full))
})
