import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sourceJsonProblems } from './source-json.js'

test('raw source checks find inline copy in contributed capabilities and schema-free JSON', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'source-json-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (dir, file, value) => {
    const path = resolve(root, dir)
    mkdirSync(path, { recursive: true })
    writeFileSync(resolve(path, file), JSON.stringify(value))
  }
  const pair = { zh: '说明', en: 'Description' }
  write('packages/example/capabilities', 'operation.json', { extends: 'operation', items: { keep: { about: pair } } })
  write('packages/example/custom', 'data.json', [{ title: '@title', symbol: 'x', note: pair }])
  write('packages/example/levels', 'labels.json', { outputLabels: { so: '@labels.so', mo: '@labels.mo' } })
  write('packages/example/i18n', 'en.json', { title: 'Title', ui: { '标题': 'Title' } })
  write('packages/example/output', 'generated.json', pair)
  const problems = sourceJsonProblems(root, [resolve(root, 'packages/example')])
  assert.equal(problems.length, 2)
  assert.match(problems[0], /^packages\/example\/capabilities\/operation\.json: items\.keep\.about:/)
  assert.match(problems[1], /^packages\/example\/custom\/data\.json: \[0\]\.note:/)
})
