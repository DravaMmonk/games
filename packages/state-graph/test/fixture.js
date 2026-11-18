import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installTableFixture, writeContentFixture, lockFixture } from '../../qed/test/fixture.js'
import { readContent, resolveLayers, layerVocabulary } from '../../../games/kit/engine/resolver.js'
export function tableFixture() {
 const root = mkdtempSync(join(tmpdir(), 'table-contract-'))
 installTableFixture(root)
 const vocabulary = layerVocabulary(resolveLayers({ package: 'state-graph', root, closure: true, unlocked: true }).layers)
 const text = en => ({ en })
 writeContentFixture(root, 'sample', {
  tagOverrides: { 'circuit/tags/circuit/part/primitives': ['table/add'] },
  game: { title: text('Tables'), chapters: [{ id: 'first', chapter: { title: text('Tables') }, levels: ['double'] }] },
  glossary: { groups: [], entries: [] },
  levels: { double: { title: text('Double'), short: text('Double'), intro: [], mission: { goal: text('Double the given cell.'), how: text('Add the previous cell twice.') }, robot: 'state-graph/scout', adds: ['table/add'], debrief: { title: text('Done'), body: [] },
   tasks: [{ id: 'double', play: 'state-graph/circuit', world: 'state-graph/grid', tests: [{ R: 1, C: 2, given: { '0,0': 7 } }], expected: [14], solution: ['sum = table/add(view.left, view.left)', 'cell <- sum'], naive: ['cell <- view.left'] }],
  } },
 }, vocabulary)
 const update = (file, key, ids) => {
  const data = JSON.parse(readFileSync(file))
  for (const id of ['state-graph', 'table', 'image', ...ids]) data[key][id] = '^0.0.0'
  writeFileSync(file, JSON.stringify(data))
 }
 update(join(root, 'packages/sample/package.json'), 'uses', [])
 update(join(root, 'games/sample/game.json'), 'packages', ['imglib', 'cvlib', 'mllib'])
 lockFixture(root)
 return { root, content: readContent('sample', root), cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
