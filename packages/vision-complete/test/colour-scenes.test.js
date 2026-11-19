import test from 'node:test'
import assert from 'node:assert/strict'
import { channel, compare, image, zip } from 'imglib'
import { LEARNING } from '../core/items/scenes/learning.js'

test('colour scene variants expose RGB inputs without changing their targets', () => {
  const examples = [
    ['colour', 'rgbContrast', { paint: 'halves' }, { mix: 'redGreen' }, 0.5],
    ['colour', 'rgbContrast', { paint: 'skyline' }, { mix: 'blueYellow' }, 0.5],
    ['street', 'rgbStreet', { layout: 'crossing' }, {}, 0],
    ['colourMix', 'rgbMix', { paint: 'blueSquare' }, {}, 0],
  ]
  for (const [oldName, newName, fields, setup, offset] of examples) {
    const old = LEARNING[oldName].make(fields, setup)
    const updated = LEARNING[newName].make(fields, setup)
    for (const [i, key] of ['r', 'g', 'b'].entries()) {
      const restored = zip(old.inputs[key], image(old.inputs[key].w, old.inputs[key].h, offset), (a, b) => a + b)
      assert.equal(compare(channel(updated.inputs.photo, i), restored, { tolerance: 1e-6 }).pass, true)
    }
    assert.deepEqual(Object.keys(updated.expected).sort(), Object.keys(old.expected).sort())
    for (const name of Object.keys(old.expected)) assert.equal(compare(updated.expected[name], old.expected[name], { tolerance: 1e-6 }).pass, true)
  }
})
