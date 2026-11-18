import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GAME_LISTS, PACKAGE_LISTS, capabilityKey, capabilityOf, currentOf, isObjectList, listOfHeading, openParams, overrideKey, readHeading, readOpen } from './left-lists.js'
import { objectFileName, objectOp, objectValue, overrideFileName, overrideOp, ownObjectData } from './object-file.js'
import { fileForm, opFor } from './form.js'

test('the packages are the first list of the package workspace, search the last; the object lists are told apart', () => {
  assert.deepEqual(PACKAGE_LISTS, ['packages', 'tree', 'entries', 'kernel', 'overrides', 'search'])
  assert.ok(!isObjectList('packages'))
  assert.deepEqual(GAME_LISTS, ['games', 'packages', 'chapters', 'overrides'])
  assert.ok(isObjectList('overrides') && isObjectList('kernel'))
  assert.ok(!isObjectList('tree') && !isObjectList('search') && !isObjectList('toString'))
})

test('the address keeps what is open: an object list’s object, or a group’s heading', () => {
  assert.deepEqual(openParams('kernel', { capability: 'operation/logic/and', override: 'x' }), [['capability', 'operation/logic/and']])
  assert.deepEqual(openParams('tree', { capability: 'x' }), [])
  assert.deepEqual(readOpen(new URLSearchParams('capability=operation/logic/and')), { list: 'kernel', open: { capability: 'operation/logic/and' } })
  // The old tabs that only switched to a list open that list.
  assert.deepEqual(readOpen(new URLSearchParams('tab=kernel')), { list: 'kernel', open: {} })
  assert.deepEqual(readOpen(new URLSearchParams('tab=page')), { list: null, open: {} })
  // A workspace without the list ignores its parameter.
  assert.deepEqual(readOpen(new URLSearchParams('capability=x&override=x'), GAME_LISTS), { list: 'overrides', open: { override: 'x' } })
  assert.deepEqual(readHeading(new URLSearchParams('object=sample/collection demo/main&level=demo/a')), { kind: 'sample/collection', full: 'demo/main' })
  assert.equal(readHeading(new URLSearchParams('level=demo/a')), null)
  assert.deepEqual(['tag', 'relation', 'sample/collection', 'section'].map((k) => listOfHeading(k)), ['tree', 'tree', 'type:sample/collection', 'type:entry'])
  assert.equal(listOfHeading('tag', 'sample/item'), 'type:sample/item')
  assert.equal(listOfHeading('tag', 'other/item'), 'type:other/item')
})

test('a capability and an override have one key each', () => {
  assert.equal(capabilityKey('operation', 'logic/and'), 'operation/logic/and')
  assert.deepEqual(capabilityOf('operation/logic/and'), { kind: 'operation', name: 'logic/and' })
  assert.equal(capabilityOf('nothing'), null)
  assert.equal(overrideKey({ layer: '@game', kind: 'section', name: 'demo/map' }), '@game section demo/map')
  assert.deepEqual(currentOf([['a', 1], ['b', 2]], 'b'), ['b', 2])
  assert.deepEqual(currentOf([['a', 1], ['b', 2]], 'z'), ['a', 1])
  assert.equal(currentOf([], 'z'), null)
})

const content = {
  registries: {
    tag: {
      'level:demo/first': { id: 'demo/first', kind: 'level', title: { en: 'First', $key: 'demo/tags.first' }, values: ['demo/a', 'other/b', '#demo/inner'] },
      'level:other/far': { kind: 'level', values: ['other/b'] },
    },
    section: { 'demo/map': { title: 'Words', values: [] } },
  },
}
const section = { folder: 'sections', schema: { type: 'obj', fields: {} } }
const object = (full, kind = 'tag') => ({ kind, full, namespace: 'demo', value: objectValue(content, kind, full), ...(kind === 'tag' ? { tagKind: 'level' } : { declared: section }) })

test('an object’s file is the registry’s value without its id (a tag without its kind, which its folder says), written back by short names', () => {
  assert.equal(objectValue(content, 'tag', 'level:demo/first').id, undefined)
  assert.equal(objectValue(content, 'tag', 'level:demo/first').kind, undefined)
  assert.equal(objectValue(content, 'tag', 'level:demo/none'), null)
  assert.equal(objectFileName('tag', 'level:demo/first'), 'demo/tags/level/first.json')
  assert.equal(objectFileName('section', 'demo/map', null, null, section), 'demo/sections/map.json')
  assert.equal(objectFileName('section', 'demo/map', null, 'demo', section), 'sections/map.json')
  assert.deepEqual(ownObjectData('demo', objectValue(content, 'tag', 'level:demo/first')),
    { title: { en: 'First', $key: 'tags.first' }, values: ['a', 'other/b', '#inner'] })
})

test('an edit of the layer’s own object is its object operation; another layer’s makes none', () => {
  assert.deepEqual(objectOp(object('level:demo/first'), ['values', 1], { set: 'demo/c' }), { op: 'tag.set', tag: 'first', member: 'level', path: ['values', 1], value: 'c' })
  assert.deepEqual(objectOp(object('level:demo/first'), ['title'], { set: 'Erste', lang: 'de' }, 'text'),
    { op: 'tag.set', tag: 'first', member: 'level', path: ['title'], value: { en: 'First', de: 'Erste', $key: 'tags.first' } })
  assert.deepEqual(objectOp(object('level:demo/first'), ['title'], { unset: true }), { op: 'tag.put', tag: 'first', member: 'level', data: { values: ['a', 'other/b', '#inner'] } })
  assert.deepEqual(objectOp(object('demo/map', 'section'), ['values'], { set: ['demo/a'] }), { op: 'object.set', kind: 'section', name: 'map', path: ['values'], value: ['a'] })
  assert.equal(objectOp(object('level:demo/first'), [], { unset: true }), null)
  assert.equal(objectOp(object('level:other/far'), ['values'], { set: [] }), null)
  // The forms reach them through the same file operation as any other file.
  assert.deepEqual(opFor({ object: object('demo/map', 'section') }, 'values', { set: ['demo/a'] }), { op: 'object.set', kind: 'section', name: 'map', path: ['values'], value: ['a'] })
  const shown = fileForm(content, {}, { object: { kind: 'section', full: 'demo/map', declared: section } }, [])
  assert.deepEqual(shown.value, { title: 'Words', values: [] })
  assert.equal(shown.form.kind, 'obj')
})

test('only the owning layer can edit an override file', () => {
  const layout = { layer: '@game', kind: 'section', name: 'demo/map' }
  assert.deepEqual(overrideOp(layout, '@game', { rows: [] }), { op: 'override.put', layer: '@game', kind: 'section', name: 'demo/map', data: { rows: [] } })
  assert.equal(overrideOp(layout, 'demo', { rows: [] }), null)
})


test('override audit paths mirror each object declaration folder', () => {
  const event = { layer: 'extra', name: 'base/item' }
  assert.equal(overrideFileName({ ...event, kind: 'sample/item' }, { objectKinds: { 'sample/item': { folder: 'parts' } } }), 'extra/overrides/base/parts/item.json')
  assert.equal(overrideFileName({ ...event, kind: 'level' }), 'extra/overrides/base/levels/item.json')
  assert.equal(overrideFileName({ ...event, kind: 'tag', after: { kind: 'circuit/part' } }), 'extra/overrides/base/tags/circuit/part/item.json')
  assert.equal(overrideFileName({ ...event, kind: 'tag', after: { kind: 'entry' } }), 'extra/overrides/base/tags/entry/item.json')
})
