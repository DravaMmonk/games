import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyLang, languageOptions } from '../lang.js'
import { uiWords } from './ui-words.js'

test('a fixture language switches the UI and falls back to Chinese', () => {
  const fr = JSON.parse(readFileSync(new URL('./fixtures/fr.json', import.meta.url), 'utf8')).ui
  const { tr, T } = uiWords({ en: { 清空: 'Clear' }, fr })
  const language = { lang: '' }
  const window = new EventTarget()
  globalThis.document = { documentElement: language }
  globalThis.window = window
  try {
    const changes = []
    window.addEventListener('langchange', event => changes.push(event.detail))
    applyLang('en')
    assert.equal(tr('清空'), 'Clear')
    applyLang('fr')
    assert.equal(tr('清空'), 'Effacer')
    assert.equal(tr('第 {n} 关', { n: 3 }), 'Niveau 3')
    assert.equal(tr('返回'), '返回')
    assert.equal(T('第 {n} 关', { n: 3 }).fr, 'Niveau 3')
    assert.equal(language.lang, 'fr')
    assert.deepEqual(changes, ['en', 'fr'])
    assert.equal(languageOptions().some(([id]) => id === 'fr'), false)
  } finally {
    applyLang('en')
    delete globalThis.document
    delete globalThis.window
  }
})
