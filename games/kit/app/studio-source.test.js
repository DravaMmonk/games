import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { localSourceRequest, sourceTools } from './studio-source.js'

test('Studio edits only workspace source and rejects stale or invalid writes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-source-'))
  try {
    const dir = join(root, 'packages/sample')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{"kind":"lib","version":"0.0.0","kernel":"^0.0.0","uses":{}}')
    let saves = 0
    const tools = sourceTools(root, () => { saves += 1 })
    const packageTarget = { package: 'sample' }
    const target = { ...packageTarget, path: 'core/math/calc.js' }
    const first = 'export const plus = (a, b) => a + b\n'
    const second = 'export const plus = (a, b) => Number(a) + Number(b)\n'
    assert.deepEqual(tools.source_packages.run(), ['sample'])
    assert.deepEqual(tools.source_list.run(packageTarget), { files: [], matches: [] })
    const created = await tools.source_save.run({ ...target, text: first, base: null })
    assert.deepEqual(tools.source_read.run(target), created)
    assert.deepEqual(tools.source_list.run({ ...packageTarget, symbol: 'plus' }), { files: [target.path], matches: [target.path] })
    writeFileSync(join(dir, 'core/another.js'), '// plus is referenced here.\n')
    writeFileSync(join(dir, 'core/math/builtins.js'), 'export default {\n  plus: (a, b) => a + b,\n}\n')
    assert.deepEqual(tools.source_list.run({ ...packageTarget, symbol: 'plus' }).matches,
      ['core/math/builtins.js', 'core/another.js', target.path])
    assert.deepEqual(tools.source_list.run({ ...packageTarget, symbol: 'lus' }).matches, [])
    await assert.rejects(tools.source_save.run({ ...target, text: 'export const =', base: created.revision }), /Unexpected token/)
    await assert.rejects(tools.source_save.run({ ...target, text: "import fs from 'node:fs'", base: created.revision }), /undeclared or private import/)
    const updated = await tools.source_save.run({ ...target, text: second, base: created.revision })
    assert.notEqual(updated.revision, created.revision)
    await assert.rejects(tools.source_save.run({ ...target, text: first, base: created.revision }), /changed on disk/)
    await assert.rejects(tools.source_save.run({ ...target, text: first, base: null }), /changed on disk/)
    assert.equal(readFileSync(join(dir, target.path), 'utf8'), second)
    assert.equal(saves, 2)
    symlinkSync(join(dir, 'core/math'), join(dir, 'core/link'))
    assert.throws(() => tools.source_read.run({ ...target, path: 'core/link/calc.js' }), /Invalid source path/)
    assert.throws(() => tools.source_read.run({ ...target, path: 'core/../calc.js' }), /Use a JavaScript path/)
    assert.throws(() => tools.source_list.run({ package: '../sample' }), /Invalid package ID/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Studio source tools accept loopback same-origin JSON requests only', () => {
  const allowed = { headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json' },
    socket: { remoteAddress: '::1' } }
  assert.ok(localSourceRequest(allowed))
  for (const headers of [{ origin: 'http://different.test' }, { host: 'different.test' }, { 'content-type': 'text/plain' }]) {
    assert.ok(!localSourceRequest({ ...allowed, headers: { ...allowed.headers, ...headers } }))
  }
  assert.ok(!localSourceRequest({ ...allowed, socket: { remoteAddress: '192.0.2.1' } }))
})
