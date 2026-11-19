import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { withReadCache, memoResolution } from './read-cache.js'

test('read requests keep caller data isolated and invalidate changes under a linked package root', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'author-cache-'))
  try {
    const source = resolve(root, 'workspace-packages')
    mkdirSync(source)
    symlinkSync(source, resolve(root, 'packages'), 'dir')
    const file = resolve(source, 'input.json')
    writeFileSync(file, 'a')
    let runs = 0
    const fn = () => true
    const read = () => withReadCache(root, async () => {
      await Promise.resolve()
      return memoResolution('test', () => ({ count: ++runs, nested: [1], fn }))
    })
    const first = await read()
    first.nested.push(2)
    assert.deepEqual(await read(), { count: 1, nested: [1], fn })
    writeFileSync(file, 'b')
    assert.equal((await read()).count, 2)
    renameSync(file, `${file}.renamed`)
    assert.equal((await read()).count, 3)
    rmSync(`${file}.renamed`)
    assert.equal((await read()).count, 4)
    assert.equal(memoResolution('test', () => 'outside'), 'outside')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('cached resolution preserves assembly and observes edits, additions and deletions', async () => {
  const { readPackage } = await import('./resolver.js')
  const root = mkdtempSync(resolve(tmpdir(), 'resolved-cache-'))
  const folder = resolve(root, 'packages/library')
  mkdirSync(resolve(folder, 'topic'), { recursive: true })
  mkdirSync(resolve(folder, 'kinds'))
  writeFileSync(resolve(folder, 'kinds/topic.json'), JSON.stringify({ declares: 'package', overrides: { package: ['*'] }, schema: { type: 'any' } }))
  writeFileSync(resolve(folder, 'package.json'), JSON.stringify({ kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} }))
  const file = resolve(folder, 'topic/one.json')
  const put = title => writeFileSync(file, JSON.stringify({ title: { en: title }, body: [] }))
  const cached = () => withReadCache(root, () => readPackage('library', root))
  const entry = content => content.registries['library/topic']['library/one']
  try {
    put('First')
    const first = cached()
    assert.deepEqual(first, readPackage('library', root))
    entry(first).body.push('caller edit')
    assert.deepEqual(entry(cached()).body, [])
    put('Other')
    assert.equal(entry(cached()).title.en, 'Other')
    rmSync(file)
    assert.equal(entry(cached()), undefined)
    put('Again')
    assert.equal(entry(cached()).title.en, 'Again')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
