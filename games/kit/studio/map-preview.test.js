import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapPreviewGame } from './map-preview.js'

test('the route preview replaces old authored wires and retains knowledge prerequisites', () => {
  const content = {
    id: 'g',
    eras: [{ id: 'chapter', levels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], links: [{ from: 'b', to: 'c' }] }],
    levels: [{ id: 'a' }, { id: 'b' }, { id: 'c', requires: ['a'] }],
  }
  const game = { levels: [{ id: 'a' }, { id: 'b' }, { id: 'c', requires: ['a', 'b'] }] }
  const shown = mapPreviewGame(game, content, [{ from: 'b', to: 'a' }])
  assert.deepEqual(shown.levels.map(level => level.requires), [['b'], [], ['a']])
  assert.deepEqual(game.levels[2].requires, ['a', 'b'])
})
