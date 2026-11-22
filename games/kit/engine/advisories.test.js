import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S } from './schema.js'
import { adviseText, advisories, copyAdvisories } from './advisories.js'

test('a text is read by the rules of its field', () => {
  assert.deepEqual(adviseText('title', { zh: '很长很长很长的关卡名', en: 'Long' }), [{ rule: 'copy-length', says: 'title zh 10/8' }])
  assert.deepEqual(adviseText('title', { zh: '短名', en: 'A translation far longer than the bound' }), [{ rule: 'copy-length', says: 'title en 39/24' }])
  assert.deepEqual(adviseText('title', { zh: '短名', en: 'Short', $key: 'demo/a-key-that-is-not-a-wording-of-the-text' }), [])
  // Markup and references are not counted; a field without a bound is held to the word rules only.
  assert.deepEqual(adviseText('title', '<b>四个字</b><demo-ref to="demo/x"></demo-ref>'), [])
  assert.deepEqual(adviseText('label', '稍后就行'), [{ rule: 'copy-banned', says: '「就行」' }, { rule: 'copy-ahead', says: '「稍后」' }])
  assert.deepEqual(adviseText('hint', { zh: '看上一关。', en: 'See the previous level.' }), [{ rule: 'copy-pointing', says: '「上一关」' }])
  // A reason belongs in the intro, and only an intro's first paragraph is held to how it opens.
  assert.deepEqual(adviseText('brief', '因为要进位，接上它。'), [{ rule: 'copy-brief-why', says: '「因为」' }])
  assert.deepEqual(adviseText('intro', '因为要进位。'), [])
  assert.deepEqual(adviseText('intro', '新元件来了。', { first: true }), [{ rule: 'copy-intro-part', says: '「新元件」' }])
  assert.deepEqual(adviseText('intro', '新元件来了。'), [])
})

const vocabulary = { level: S.obj({ title: S.text(), brief: S.text(), intro: S.list(S.obj({ t: S.text() })) }) }
const passage = '这一段话在两关里一字不差地出现。'

test('copy advisories name the level and the field, and see a passage said twice', () => {
  const levels = [
    { id: 'demo/one', title: { zh: '很长很长很长的关卡名' }, brief: passage, intro: [{ t: passage }] },
    { id: 'demo/two', title: '二', brief: passage, intro: [{ t: '另一段。' }, { t: { zh: passage, en: 'Said twice.' } }] },
  ]
  assert.deepEqual(copyAdvisories({ levels }, vocabulary).map(({ on: _, ...rest }) => rest), [
    { rule: 'copy-length', level: 'demo/one', path: 'title', says: 'title zh 10/8' },
    { rule: 'copy-repeat', level: 'demo/two', path: 'intro[1].t', says: '= demo/one' },
  ])
})

test('an advisory keeps its id until what it was raised on changes; a package gets no course advisories', async () => {
  const level = title => ({ id: 'demo/one', title, intro: [{ t: '稍后再说。' }] })
  const domain = { vocabulary, spec: content => content, checkPhase: ({ phase }) => phase === 'advisory' ? [{ rule: 'many-new', level: 'demo/one', says: 'demo/a, demo/b' }] : assert.fail(phase) }
  const found = await advisories({ levels: [level({ zh: '很长很长很长的关卡名' })] }, domain)
  assert.deepEqual(found.map(({ id: _, ...rest }) => rest), [
    { rule: 'copy-length', level: 'demo/one', path: 'title', says: 'title zh 10/8' },
    { rule: 'copy-ahead', level: 'demo/one', path: 'intro[0].t', says: '「稍后」' },
    { rule: 'many-new', level: 'demo/one', path: '', says: 'demo/a, demo/b' },
  ])
  const reworded = await advisories({ levels: [level({ zh: '仍然很长很长的关卡名' })] }, domain)
  assert.notEqual(reworded[0].id, found[0].id)
  assert.deepEqual(reworded.slice(1).map(({ id }) => id), found.slice(1).map(({ id }) => id))
  assert.deepEqual((await advisories({ packageTarget: true, levels: [level('短')] }, domain)).map(({ rule }) => rule), ['copy-ahead'])
})
