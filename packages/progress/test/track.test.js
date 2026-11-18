import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addGlossaryFixture, lockFixture, storyRoot } from '../../../games/kit/engine/test-fixture.js'
import { readContent } from '../../../games/kit/engine/resolver.js'
import { objectProgress, trackMeaning } from '../core/index.js'

test('a text course uses named, typed tracks for encyclopedia entries and levels without circuit', t => {
  const { root } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const file of ['package.json', 'core', 'view', 'i18n', 'kinds']) {
    cpSync(new URL(`../${file}`, import.meta.url), join(root, 'packages/progress', file), { recursive: true })
  }
  addGlossaryFixture(root, 'story', 'story')
  for (const [file, field] of [['packages/story/package.json', 'uses'], ['games/story/game.json', 'packages']]) {
    const path = join(root, file)
    const config = JSON.parse(readFileSync(path))
    config[field].progress = '^0.0.0'
    writeFileSync(path, JSON.stringify(config))
  }
  const write = (file, value) => {
    const path = join(root, 'packages/story', file)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, JSON.stringify(value))
  }
  write('entries/given.json', { title: 'Answer', body: ['Here is a clue.'] })
  write('progress-tracks/clue.json', { title: 'Clue', kind: 'entry', target: 'given', stages: [
    { id: 'learned', afterTask: 'given' }, { id: 'practised', afterLevel: 'given' },
  ] })
  write('progress-tracks/level.json', { title: 'Lesson', kind: 'level', target: 'given', stages: [{ id: 'introduced' }] })
  lockFixture(root)

  const content = readContent('story', root)
  assert.deepEqual(content.layerOrder, ['progress', 'wiki', 'story', '@story'])
  assert.deepEqual(content.objectProblems, [])
  const progress = objectProgress(content)
  assert.equal(progress({ passed: [], solved: [] }).stage('entry', 'story/given'), null)
  assert.equal(progress({ passed: ['story/given'], solved: [] }).stage('entry', 'story/given').id, 'learned')
  assert.equal(progress({ passed: [], solved: ['story/given'] }).stage('entry', 'story/given').id, 'practised')
  assert.equal(progress({ passed: [], solved: [] }).stage('level', 'story/given').id, 'introduced')
  assert.equal(progress({ passed: [], solved: [] }).stage('entry', 'story/other'), undefined)
  assert.deepEqual(trackMeaning.contentChecks({ content }), [])

  write('progress-tracks/clue.json', { title: 'Clue', kind: 'entry', target: 'another', stages: [{ id: 'locked' }] })
  assert.ok(readContent('story', root).objectProblems.some(problem => problem.kind === 'entry' && problem.target === 'story/another'))
})
