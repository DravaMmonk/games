import { logicVocabulary as circuitVocabulary } from '../../qed/test/fixture.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { readPackage, runtimeOf, resolveLayers, layerVocabulary } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { composeLayers } from '../../../games/kit/engine/layers.js'
import { vocabulary } from '../../../games/kit/engine/kernel.js'
import { defineParts } from '../../circuit/core/index.js'
import { lockFixture, writeContentFixture, installTableFixture, installScalarFixture } from '../../qed/test/fixture.js'

const text = en => ({ en })
const numericParts = Object.fromEntries([
  ['add', 'plus'], ['subtract', 'minus'], ['multiply', 'times'], ['divide', 'over'],
].map(([name, operation]) => [name, {
  icon: 'Plus', name: text(name), desc: text(name), family: 'circuit/value',
  inputs: ['a', 'b'].map(name => ({ name, type: 'kernel/number' })),
  outputType: 'kernel/number', op: `numlib/${operation}`,
}]))
const layer = (id, objects = [], uses = [], overrides = []) => ({ id, config: { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: Object.fromEntries(uses.map(id => [id, '^1.0.0'])) }, objects, overrides, catalogs: {} })

test('packages reject the retired vocabulary field and invalid ranges', () => {
  const base = layer('base')
  delete base.config.kind
  assert.throws(() => composeLayers([base], vocabulary), /missing kind/)
  base.config.kind = 'unknown'
  assert.throws(() => composeLayers([base], vocabulary), /unknown kind/)
  base.config.kind = 'lib'
  base.config.vocabulary = 1
  assert.throws(() => composeLayers([base], vocabulary), /unknown field vocabulary/)
  delete base.config.vocabulary
  base.config.kernel = 'latest'
  assert.throws(() => composeLayers([base], vocabulary), /invalid range/)
})

test('a numeric library works in packages using image and table boards, with no library levels', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'package-prototypes-'))
  const put = (path, value) => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)) }
  try {
    installTableFixture(root)
    installScalarFixture(root)
    const imageVocabulary = layerVocabulary(resolveLayers({ package: 'image', closure: true, root, unlocked: true }).layers)
    writeContentFixture(root, 'numeric-parts', { game: { vocabulary: 1 }, glossary: { groups: [], entries: [] }, partDefs: { parts: numericParts }, levels: {} }, circuitVocabulary)
    put('packages/numeric-parts/package.json', { kind: 'ext', type: 'module', uses: { circuit: '^0.0.0', numlib: '^0.0.0' }, version: '0.0.0', kernel: '^0.0.0' })
    const common = { title: text('Sample'), vocabulary: 1 }
    writeContentFixture(root, 'picture', {
      game: common, glossary: { groups: [], entries: [] }, levels: { copy: {
        title: text('Copy'), after: text('Same image.'), intro: [], tasks: [{ id: 'copy', play: 'image/graph',
          brief: text('Copy the image.'), hint: text('Connect the image.'), scene: 'image/filter',
          setup: { target: 'image/same' }, tests: [{ label: text('Square'), in: 'image/square' }], hidden: [{ label: text('Disk'), in: 'image/disk' }], solution: ['out <- in'],
        }],
      } },
    }, imageVocabulary)
    writeContentFixture(root, 'cells', {
      game: common, glossary: { groups: [], entries: [] }, levels: { copy: {
        title: text('Copy'), short: text('Copy'), intro: [], mission: { goal: text('Copy cells.'), how: text('Read the previous cell.') },
        robot: 'state-graph/scout', debrief: { title: text('Copied'), body: [] }, tasks: [{ id: 'copy', play: 'state-graph/circuit',
          hints: [text('Read the previous cell.')], world: 'state-graph/grid', tests: [{ R: 1, C: 2, given: { '0,0': 7 } }], expected: [14], solution: ['sum = numeric-parts/add(view.left, view.left)', 'cell <- sum'],
        }],
      } },
    }, layerVocabulary(resolveLayers({ package: 'state-graph', closure: true, root, unlocked: true }).layers))
    for (const id of ['picture', 'cells']) put(`packages/${id}/package.json`, { kind: 'lib', uses: { 'numeric-parts': '^0.0.0', ...(id === 'picture' ? { image: '^0.0.0' } : { 'state-graph': '^0.0.0', table: '^0.0.0' }) }, version: '1.0.0', kernel: '^0.0.0' })
    for (const id of ['numeric-parts', 'picture', 'cells']) rmSync(resolve(root, 'games', id), { recursive: true })
    lockFixture(root)
    const library = readPackage('numeric-parts', root)
    for (const content of [library, readPackage('picture', root), readPackage('cells', root)]) {
      const parts = Object.keys(content.registries['circuit/part']).filter(name => name.startsWith('numeric-parts/')).sort()
      assert.deepEqual(parts, Object.keys(numericParts).sort().map(name => `numeric-parts/${name}`))
      assert.deepEqual((await checkGame(content, { domain: await runtimeOf(content), root })).filter(line => line.fail), [], content.id)
    }
    const { PARTS } = defineParts(library.partDefs, {})
    assert.equal(PARTS['numeric-parts/add'].eval({ a: 6, b: 3 }, {}), 9)
    assert.equal(PARTS['numeric-parts/subtract'].eval({ a: 6, b: 3 }, {}), 3)
    assert.equal(PARTS['numeric-parts/multiply'].eval({ a: 6, b: 3 }, {}), 18)
    assert.equal(PARTS['numeric-parts/divide'].eval({ a: 6, b: 3 }, {}), 2)
    assert.throws(() => PARTS['numeric-parts/divide'].eval({ a: 6, b: 0 }, {}))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
