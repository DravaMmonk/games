import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readPackage } from '../../../games/kit/engine/resolver.js'
import { imageContract } from './image-contract.js'
import { imageFixture } from './fixture.js'

imageContract('sample')

test('a value view can be opened by only one level', () => {
  const fixture = imageFixture()
  try {
    const folder = join(fixture.root, 'packages/sample/levels')
    const copy = JSON.parse(readFileSync(join(folder, 'copy.json')))
    const first = { ...copy, opensViews: ['image/profile'] }
    const second = { ...first, tasks: copy.tasks.map(task => ({ ...task, id: 'other' })) }
    writeFileSync(join(folder, 'copy.json'), JSON.stringify(first))
    assert.deepEqual(readPackage('sample', fixture.root).objectProblems, [])
    writeFileSync(join(folder, 'other.json'), JSON.stringify(second))
    assert.ok(readPackage('sample', fixture.root).objectProblems.some(problem =>
      problem.at === 'levels/sample/other.opensViews' && /image\/profile is already opened by sample\/copy/.test(problem.says)))
  } finally { fixture.cleanup() }
})
