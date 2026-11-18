import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newPackage, gameOnPackage } from './scaffold.js'
import { storyRoot } from './test-fixture.js'
import { readPackage, readContent, packageConfig } from './resolver.js'

const roots = []
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))

test('packages start empty or copy installed objects without a template catalog', () => {
  const root = mkdtempSync(join(tmpdir(), 'new-package-'))
  roots.push(root)
  newPackage({ root, id: 'sample', kind: 'feature', empty: true })
  assert.equal(readPackage('sample', root).levels.length, 0)
  newPackage({ root, id: 'copy', kind: 'course', from: 'sample' })
  assert.equal(readPackage('copy', root).id, 'copy')
  assert.equal(packageConfig('sample', root).kind, 'feature')
  assert.equal(packageConfig('copy', root).kind, 'course')
  assert.equal(packageConfig('sample', root).type, 'module')
  assert.equal(packageConfig('copy', root).type, 'module')
  assert.throws(() => newPackage({ root, id: 'old', kind: 'play', empty: true }), /unknown kind "play"/)
  assert.throws(() => newPackage({ root, id: 'missing' }), /choose --from/)
  assert.throws(() => newPackage({ root, id: 'copy', empty: true }), /there already/)
})

test('games copy installed selections and settings with an empty chapter', () => {
  const { root, id } = storyRoot()
  roots.push(root)
  gameOnPackage({ root, id: 'sample', from: id, title: 'Sample' })
  const content = readContent('sample', root)
  assert.deepEqual(content.sourceChapters[0].levels, [])
  assert.equal(content.title.en, 'Sample')
  assert.throws(() => gameOnPackage({ root, id: 'sample', from: id }), /there already/)
})
