// Exercise the public CLI against temporary content, never checked-in games. The operations themselves are tested in
// process (layers.test.js: game package selection); this is the command line reaching them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { storyRoot } from '../test-fixture.js'

test('the CLI parses an operation’s arguments and its reason, and applies it', t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'packages/library'), { recursive: true })
  writeFileSync(join(root, 'packages/library/package.json'), JSON.stringify({ kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} }))
  execFileSync(process.execPath, [join(import.meta.dirname, 'cli.js'), id, 'game.package.add', 'package=library', 'range=^1.0.0', '--why', 'Select test library'], { env: { ...process.env, GAMES_ROOT: root }, encoding: 'utf8' })
  assert.equal(JSON.parse(readFileSync(join(root, 'games', id, 'game.json'))).packages.library, '^1.0.0')
  assert.equal(JSON.parse(readFileSync(join(root, 'games', id, 'changes.jsonl'), 'utf8').trim().split('\n').at(-1)).why, 'Select test library')
})
