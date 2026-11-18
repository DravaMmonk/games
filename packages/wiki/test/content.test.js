import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assemble } from '../../../games/kit/engine/content.js'
import { S } from '../../../games/kit/engine/schema.js'
import { applyOverride } from '../../../games/kit/engine/layers.js'
import { glossarySchemas } from './fixture.js'

test('sections order independently of tags, share entries and collect ungrouped entries under Other', () => {
  const schemas = glossarySchemas({ game: S.obj({}), level: S.obj({}), kinds: {} })
  const content = assemble({ id: 'sample', schemas, game: {}, levels: [],
    contentObjects: { entry: Object.fromEntries(['a', 'b', 'c'].map(id => [id, { title: id, body: [] }])), section: { first: { title: 'First', values: ['b', 'a'] }, second: { title: 'Second', values: ['b'] } } },
    tags: [['words', { kind: 'entry', title: 'Studio only', values: ['a', 'b'] }]],
  })
  assert.deepEqual(content.objectProblems, [])
  assert.deepEqual(content.glossary.groups.map(group => [group.id, group.values]), [
    ['sample/first', ['sample/b', 'sample/a']], ['sample/second', ['sample/b']], ['', ['sample/c']],
  ])
  assert.deepEqual(content.glossary.groups.at(-1).title, { zh: '其它', en: 'Other' })
  assert.deepEqual(applyOverride('section', { title: 'First', values: ['a'] }, { values: { remove: ['a'], add: ['b'] } }, schemas), { title: 'First', values: ['b'] })
  assert.equal(Object.hasOwn(content.registries, 'layout'), false)
  assert.equal(content.trays, undefined)
})

test('entry files and course ordering require the package to be selected', async () => {
  const { addGlossaryFixture, installGlossaryFixture, testProject } = await import('../../../games/kit/engine/test-fixture.js')
  const { readContent, readPackage } = await import('../../../games/kit/engine/resolver.js')
  const { root, put } = testProject()
  installGlossaryFixture(root)
  const pkg = { kind: 'course', version: '0.0.0', kernel: '^0.0.0', uses: {} }
  put('packages/topic/package.json', pkg)
  put('games/course/game.json', { kernel: pkg.kernel, packages: { topic: '^0.0.0' }, encyclopedia: [] })
  assert.throws(() => readContent('course', root), /@course\/game\.json\.encyclopedia: requires package wiki/)
  put('packages/topic/entries/start.json', { title: 'Start', body: ['An opening definition.'] })
  assert.throws(() => readPackage('topic', root), /topic\/entries: requires package wiki in uses/)
  addGlossaryFixture(root, 'topic', 'course')
  assert.equal(readContent('course', root).glossary.entries[0].id, 'topic/start')
  put('packages/other/package.json', pkg)
  const other = readPackage('other', root)
  assert.equal(other.glossary, undefined)
  const { contentSchemas } = await import('../../../games/kit/engine/content.js')
  const { validate } = await import('../../../games/kit/engine/schema.js')
  assert.match(validate(S.text(), '<wiki-ref to="topic/start"></wiki-ref>', { vocabulary: contentSchemas.get(other) })[0].says, /is no markup/)
})

test('wiki references follow the layer contributing the text and game entries keep their own namespace', async () => {
  const { addGlossaryFixture, lockFixture, testProject } = await import('../../../games/kit/engine/test-fixture.js')
  const { readContent, readPackage } = await import('../../../games/kit/engine/resolver.js')
  const { root, put } = testProject()
  put('packages/topic/package.json', { kind: 'course', version: '0.0.0', kernel: '^0.0.0', uses: {} })
  put('games/course/game.json', { kernel: '^0.0.0', packages: { topic: '^0.0.0' }, encyclopedia: ['play'] })
  addGlossaryFixture(root, 'topic', 'course')
  put('packages/topic/entries/start.json', { title: 'Start', body: ['@start.body'] })
  put('packages/topic/i18n/en.json', { 'start.body': 'Start here.' })
  put('games/course/entries/overview.json', { title: 'Overview', body: ['@overview.body'] })
  put('games/course/i18n/en.json', { 'overview.body': 'Read <wiki-ref to="topic/start"></wiki-ref>.' })
  put('games/course/sections/play.json', { title: 'Play', values: ['overview', 'topic/start'] })
  put('games/course/overrides/topic/i18n/en.json', { 'start.body': 'See <wiki-ref to="overview"></wiki-ref>.' })
  lockFixture(root)
  const content = readContent('course', root)
  assert.deepEqual(content.objectProblems, [])
  assert.deepEqual(content.glossary.groups.map(group => [group.id, group.values]), [
    ['@course/play', ['@course/overview', 'topic/start']],
  ])
  assert.match(content.registries.entry['topic/start'].body[0].en, /to="@course\/overview"/)

  put('packages/topic/i18n/en.json', { 'start.body': 'See <wiki-ref to="@course/overview"></wiki-ref>.' })
  assert.ok(readContent('course', root).objectProblems.some(problem => problem.layer === 'topic' &&
    problem.target === '@course/overview' && problem.reason === 'undeclared dependency'))
  assert.ok(readPackage('topic', root).objectProblems.some(problem => problem.layer === 'topic' &&
    problem.target === '@course/overview' && problem.reason === 'missing'))
})
