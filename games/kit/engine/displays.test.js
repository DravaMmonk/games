import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCapabilityRegistry } from './capabilities.js'
import { createDisplayResolver } from './displays.js'
import { capabilities } from './kernel.js'


test('display implementations require declarations and reject duplicate registration', () => {
  const registry = createCapabilityRegistry({ display: { implementation: { side: 'view' } } })
  assert.throws(() => registry.implement('display', 'toy/card', 'toy/view', 'view'), /undeclared display/)
  registry.add('display', 'toy/card', { about: 'A card' })
  assert.throws(() => registry.implement('display', 'toy/card', null, 'view'), /needs its package view entry/)
  registry.implement('display', 'toy/card', 'toy/view', 'view')
  assert.throws(() => registry.implement('display', 'toy/card', 'toy/view', 'view'), /duplicate display/)
})

test('display resolution mixes modules, loads each bundle once and rejects missing implementations', async () => {
  const registry = createCapabilityRegistry({ display: { implementation: { side: 'view' } } })
  let loads = 0
  const card = () => null
  const load = async () => { loads++; return { 'toy/card': card, 'toy/panel': { text: 'panel' } } }
  for (const name of ['toy/card', 'toy/panel', 'toy/missing', 'other/figure']) registry.add('display', name, { about: name })
  for (const name of ['toy/card', 'toy/panel', 'toy/missing']) registry.implement('display', name, 'toy/view', 'view')
  registry.implement('display', 'other/figure', 'other/view', 'view')
  const resolve = createDisplayResolver(registry, (entry) => entry === 'toy/view' ? load() : { 'other/figure': card })
  const [first, second] = await Promise.all([resolve(['toy/card', 'other/figure']), resolve(['toy/panel'])])
  assert.equal(first['toy/card'], card)
  assert.equal(first['other/figure'], card)
  assert.equal(second['toy/panel'].text, 'panel')
  assert.equal(loads, 1)
  await assert.rejects(resolve(['toy/missing']), /missing implementation/)
  await assert.rejects(resolve(['toy/undeclared']), /no registered implementation/)
})

test('the kernel installs no gameplay display implementations', () => {
  assert.deepEqual(Object.keys(capabilities.implementations), [])
  assert.deepEqual(capabilities.tables.display, undefined)
})
