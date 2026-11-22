import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S } from './schema.js'
import { adviseText, advisories } from './advisories.js'

test('a text is read by the rules of its field', () => {
  assert.deepEqual(adviseText('title', { zh: '很长很长的关卡名', en: 'Long' }), [{ rule: 'copy-length', says: 'title zh 8/6' }])
  assert.deepEqual(adviseText('title', { zh: '短名', en: 'A translation far longer than the bound' }), [{ rule: 'copy-length', says: 'title en 39/18' }])
  assert.deepEqual(adviseText('title', { zh: '短名', en: 'Short', $key: 'demo/a-key-that-is-not-a-wording' }), [])
  // Markup and references are not counted; a field without a bound is held to the word rules only.
  assert.deepEqual(adviseText('title', '<b>四个字</b><demo-ref to="demo/x"></demo-ref>'), [])
  assert.deepEqual(adviseText('label', '下一关就行'), [{ rule: 'copy-banned', says: '「就行」' }, { rule: 'copy-ahead', says: '「下一关」' }])
})

test('advisories name the level, the field and the wording they were raised on', () => {
  const vocabulary = { level: S.obj({ title: S.text(), intro: S.list(S.obj({ t: S.text() })) }) }
  const level = (title) => ({ id: 'demo/one', title, intro: [{ t: { zh: '稍后再说。' } }] })
  const found = advisories({ levels: [level({ zh: '很长很长的关卡名' })] }, vocabulary)
  assert.deepEqual(found.map(({ id: _, ...rest }) => rest), [
    { rule: 'copy-length', level: 'demo/one', path: 'title', says: 'title zh 8/6' },
    { rule: 'copy-ahead', level: 'demo/one', path: 'intro[0].t', says: '「稍后」' },
  ])
  const reworded = advisories({ levels: [level({ zh: '仍然很长的关卡名' })] }, vocabulary)
  assert.notEqual(reworded[0].id, found[0].id)
  assert.equal(reworded[1].id, found[1].id)
})
