import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addGlossaryFixture, lockFixture, storyRoot } from '../../../games/kit/engine/test-fixture.js'
import { readContent } from '../../../games/kit/engine/resolver.js'
import { courseLayout } from '../../../games/kit/engine/course-dependencies.js'
import { objectProgress, progressMeaning } from '../core/index.js'

test('a text course configures inline stages and grants by object type without circuit', t => {
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
  write('entries/given.json', { title: 'Answer', body: ['Here is a clue.'], stages: [
    { id: 'learned', afterTask: 'given', title: 'Clue unlocked' }, { id: 'practised', afterLevel: 'given' },
  ] })
  write('entries/bonus.json', { title: 'Bonus', body: ['A completion reward.'] })
  write('entries/other.json', { title: 'Extra', body: ['A reusable entry.'], stages: [{ id: 'extra', afterTask: 'given' }] })
  write('progress-policies/entries.json', { kind: 'entry', targets: ['given', 'bonus'], stages: true, grants: true, unlocks: true, checks: ['stages', 'references'] })
  write('progress-policies/levels.json', { kind: 'level', stages: true })
  const file = join(root, 'packages/story/levels/given.json')
  const level = JSON.parse(readFileSync(file))
  level.stages = [{ id: 'introduced' }]
  level.tasks[0].awards = ['bonus']
  writeFileSync(file, JSON.stringify(level))
  write('levels/review.json', { title: 'Review', requiresObjects: ['bonus', 'practised'],
    tasks: [{ id: 'review', play: 'story/answer', brief: 'Answer yes again.' }] })
  const chapter = join(root, 'games/story/chapters/ground.json')
  writeFileSync(chapter, JSON.stringify({ chapter: { title: 'Opening' }, levels: ['story/given', 'story/review'] }))
  lockFixture(root)

  const content = readContent('story', root)
  assert.deepEqual(content.layerOrder, ['progress', 'wiki', 'story', '@story'])
  assert.deepEqual(content.objectProblems, [])
  const progress = objectProgress(content)
  assert.equal(progress({ passed: [], solved: [] }).stage('entry', 'story/given'), null)
  assert.equal(progress({ passed: ['story/given'], solved: [] }).stage('entry', 'story/given').id, 'story/learned')
  assert.equal(progress({ passed: [], solved: ['story/given'] }).stage('entry', 'story/given').id, 'story/practised')
  assert.equal(progress({ passed: [], solved: [] }).stage('level', 'story/given').id, 'story/introduced')
  assert.equal(progress({ passed: [], solved: [] }).stage('entry', 'story/other'), undefined)
  assert.equal(progress({ passed: ['story/given'], solved: [] }).stage('entry', 'story/given').definition.title, 'Clue unlocked')
  assert.equal(progress({ passed: [], solved: [] }).stage('entry', 'story/bonus'), null)
  assert.equal(progress({ passed: ['story/given'], solved: [] }).stage('entry', 'story/bonus').id, 'story/bonus')
  assert.deepEqual(progressMeaning.contentChecks({ content }), [])
  assert.ok(courseLayout(content).dependencyLinks.some(link => link.from === 'story/given' && link.to === 'story/review' && link.source === 'reference'))

  level.tasks[0].awards = ['another']
  writeFileSync(file, JSON.stringify(level))
  assert.ok(readContent('story', root).objectProblems.some(problem => problem.kind === 'entry' && problem.target === 'story/another'))
})
