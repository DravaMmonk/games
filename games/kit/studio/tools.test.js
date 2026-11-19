import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { S } from '../engine/schema.js'
import { defineVocabulary } from '../engine/vocabulary.js'
import { contentSchemas } from '../engine/content.js'
import { firstText } from '../engine/i18n.js'
import { readContent } from '../engine/resolver.js'
import { openPackage } from '../engine/ops/workspace.js'
import { runChangeset } from '../engine/ops/changeset.js'
import { storyRoot } from '../engine/test-fixture.js'
import { glossarySchemas } from '../../../packages/wiki/test/fixture.js'
import { bulkAdds, bulkPatch, bulkSet, bulkUnset, commonFields } from './bulk.js'
import { copyRows } from './copy.js'
import { navigableProjections } from './editors.js'
import { paletteIndex, rankPalette, scoreOf } from './palette.js'
import { itemOf } from './worklist.js'

const VOCAB = defineVocabulary({
  module: 'toy',
  version: 1,
  kinds: { part: { add: { about: 'adds' }, sub: { about: 'subtracts' } } },
  game: S.obj({ title: S.text(), eras: S.list(S.any()) }),
  level: S.by('kind', {
    board: S.obj({ kind: S.oneOf(['board', 'hand']), title: S.text(), note: S.opt(S.text()), n: S.opt(S.int()), adds: S.opt(S.list(S.ref('primitive', { reference: 'circuit/part' }))), tests: S.list(S.int(), { section: 'tests' }), hidden: S.opt(S.list(S.int(), { section: 'tests' })), solution: S.board() }),
    hand: S.obj({ kind: S.oneOf(['board', 'hand']), title: S.text(), moves: S.list(S.str()) }),
  }),
})
const LEVELS = [
  { id: 'a', kind: 'board', title: { en: '甲' }, adds: ['add'], tests: [1, 2], hidden: [3], solution: [] },
  { id: 'b', kind: 'board', title: { en: '乙' }, n: 2, tests: [1], solution: [] },
  { id: 'c', kind: 'hand', title: { en: '丙' }, moves: [] },
]

test('bulk edits are one operation a level, and the levels an edit does not fit are skipped with the reason', () => {
  assert.deepEqual(commonFields(VOCAB, LEVELS.slice(0, 2)).map((f) => f.key), ['title', 'note', 'n', 'adds', 'tests', 'hidden', 'solution'])
  assert.deepEqual(commonFields(VOCAB, LEVELS).map((f) => f.key), ['title'], 'a level of another shape: only what both shapes hold')
  assert.deepEqual(bulkSet(VOCAB, LEVELS, ['n'], 2), {
    ops: [{ op: 'level.set', level: 'a', path: ['n'], value: 2 }],
    skipped: [{ level: 'b', why: 'holds that already' }, { level: 'c', why: 'has no such field' }],
  })
  assert.deepEqual(bulkSet(VOCAB, LEVELS.slice(0, 1), ['note'], { en: '注' }).ops, [{ op: 'text.set', level: 'a', path: ['note'], lang: 'en', value: '注' }])
  assert.deepEqual(bulkSet(VOCAB, LEVELS.slice(0, 1), ['solution'], ['x = add()']).ops, [{ op: 'level.blueprint', level: 'a', path: ['solution'], text: 'x = add()' }])
  assert.deepEqual(bulkUnset(VOCAB, LEVELS, ['n']), { ops: [{ op: 'level.unset', level: 'b', path: ['n'] }], skipped: [{ level: 'a', why: 'has none' }, { level: 'c', why: 'has none' }] })
  assert.deepEqual(bulkPatch(VOCAB, LEVELS.slice(0, 2), { n: 2, note: null }).ops, [{ op: 'level.patch', level: 'a', fields: { n: 2, note: null } }])
  assert.deepEqual(bulkPatch(VOCAB, LEVELS.slice(0, 1), { kind: 'hand' }), {
    ops: [], skipped: [{ level: 'a', why: 'would change an existing configuration type' }],
  })
  assert.deepEqual(bulkAdds(VOCAB, LEVELS, { add: ['sub'], remove: ['add'] }), {
    ops: [{ op: 'level.adds', level: 'a', add: ['sub'], remove: ['add'] }, { op: 'level.adds', level: 'b', add: ['sub'] }],
    skipped: [{ level: 'c', why: 'brings in no parts' }],
  })
})

function storyWithTwoLevels(t) {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const gameFile = join(root, 'games/story/game.json')
  const game = JSON.parse(readFileSync(gameFile, 'utf8'))
  writeFileSync(gameFile, JSON.stringify({ ...game, chapters: [...game.chapters, '@story/last'] }))
  writeFileSync(join(root, 'games/story/chapters/last.json'), JSON.stringify({ levels: ['story/end'] }))
  writeFileSync(join(root, 'packages/story/levels/end.json'), JSON.stringify({
    title: 'Last question', tasks: [{ id: 'end', play: 'story/answer', brief: 'Answer again.' }],
  }))
  return { root, id }
}

test('a bulk preview edits both levels and creates a package level tag', async t => {
  const { root, id } = storyWithTwoLevels(t)
  const ws = openPackage(id, root)
  const before = ws.onDisk()
  const content = ws.content()
  const levels = ['story/end', 'story/given']
  const title = 'Revised question'
  const { ops, skipped } = bulkSet(contentSchemas.get(content), content.levels, ['title'], title)
  assert.deepEqual(skipped, [])
  assert.deepEqual(ops, levels.map(level => ({ op: 'text.set', level, path: ['title'], value: title })))
  const result = await runChangeset(ws, {
    ops: [...ops, { op: 'tag.put', tag: 'review', member: 'level', data: { values: levels } }],
  }, { check: false })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.deepEqual(result.content.tags['level:story/review'].values, levels)
  assert.deepEqual(result.content.levels.map(({ id, title }) => [id, firstText(title)]), levels.map(level => [level, title]))
  assert.deepEqual(ws.onDisk(), before)
})

const CONTENT = {
  id: 'toy', title: { en: '玩具' }, eras: [{ id: 1, title: { en: '第一章' }, levels: [{ id: 'a' }, { id: 'b' }] }],
  levels: LEVELS, glossary: { groups: [], entries: [{ id: 'adder', title: { en: '加法器' }, body: [] }] },
}

test('the palette indexes levels, eras, fields, entries, findings, recent fields and actions, and ranks them as typed', () => {
  const items = paletteIndex({
    content: CONTENT, projections: navigableProjections(glossarySchemas(VOCAB)), labels: [{ id: 'b', label: '1-1' }, { id: 'a', label: '1-2' }, { id: 'c', label: '1-3' }], level: 'a', fields: ['title', 'tests', 'hint[0]'],
    items: [itemOf({ fail: true, text: 'a: reference fails test 2', levels: ['a'] }), itemOf({ text: 'b: answer PASS', levels: ['b'] })],
    recent: [{ level: 'a', path: 'title' }], actions: [{ id: 'search', label: 'Search and replace', keys: 'Ctrl+Shift+F' }], lang: 'en',
  })
  assert.deepEqual(items.map((it) => it.kind), ['recent', 'action', 'level', 'level', 'level', 'era', 'field', 'field', 'field', 'projected', 'finding'])
  assert.deepEqual(items.filter((it) => it.kind === 'level').map((it) => it.label), ['1-1 乙', '1-2 甲', '1-3 丙'], 'levels in play order, by their number on the map')
  assert.equal(items.find((it) => it.kind === 'finding').finding.rule, 'domain', 'passing lines are not findings')
  assert.deepEqual(paletteIndex({ content: CONTENT, lang: 'en' }).filter(item => item.kind === 'level').map(item => item.label), ['a 甲', 'b 乙', 'c 丙'])
  assert.equal(rankPalette(items, '乙')[0].level, 'b')
  assert.equal(rankPalette(items, '1-3')[0].level, 'c')
  assert.deepEqual(rankPalette(items, 'adder')[0].path, ['entries', 0])
  assert.deepEqual(rankPalette(items, '>').map((it) => it.kind), ['action'])
  assert.deepEqual(rankPalette(items, '@hint').map((it) => it.path), ['hint[0]'])
  assert.equal(rankPalette(items, 'srch')[0].action, 'search', 'letters in order')
  assert.deepEqual(rankPalette(items, 'zzz'), [])
  assert.ok(scoreOf('Search', 'se') > scoreOf('the search', 'se') && scoreOf('the search', 'se') > scoreOf('lose', 'se') && scoreOf('lose', 'se') > scoreOf('s-x-e', 'se'))
})

test('copy rows use chapter scope, explicit level order and workspace ownership', t => {
  const { root, id } = storyWithTwoLevels(t)
  const content = readContent(id, root)
  const vocabulary = contentSchemas.get(content)
  const order = ['story/end', 'story/given']
  const rows = (scope, side) => copyRows(content, vocabulary, scope, order, side)
    .map(({ key, own, file, value }) => ({ key, own, file, text: firstText(value) }))
  const given = [
    { key: 'story/given|title', own: 'package', file: { level: 'story/given' }, text: 'Question' },
    { key: 'story/given|tasks[0].brief', own: 'package', file: { level: 'story/given' }, text: 'Answer yes.' },
  ]
  const end = [
    { key: 'story/end|title', own: 'package', file: { level: 'story/end' }, text: 'Last question' },
    { key: 'story/end|tasks[0].brief', own: 'package', file: { level: 'story/end' }, text: 'Answer again.' },
  ]
  assert.deepEqual(rows(0, 'game'), [
    { key: '@story/ground|chapters[0].chapter.title', own: 'game', file: { game: true }, text: 'Opening' },
    ...given,
  ])
  assert.deepEqual(rows('all', 'game'), [
    { key: 'game.json|title', own: 'game', file: { game: true }, text: 'Story' },
    ...end, ...given,
  ])
  assert.deepEqual(rows('all', 'package'), [...end, ...given])
})
