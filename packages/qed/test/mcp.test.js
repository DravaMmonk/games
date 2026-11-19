// node --test games/kit/engine/ops — the MCP server's protocol: spawned as Claude Code would spawn it, spoken to over
// stdio in JSON-RPC, on a small game in a temp games folder (GAMES_ROOT, ./fixture.js). The tools themselves are the
// same TOOLS the Studio bridge serves, exercised directly in studio-tools.test.js.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { proofsRoot } from './fixture.js'

const { root, id: GAME } = proofsRoot()
let server
let next = 1
const waiting = new Map()

before(() => {
  server = spawn(process.execPath, [resolve(new URL('../../../games/kit/engine/ops/', import.meta.url).pathname, 'mcp.js')], { env: { ...process.env, GAMES_ROOT: root }, stdio: ['pipe', 'pipe', 'inherit'] })
  createInterface({ input: server.stdout }).on('line', (line) => {
    const message = JSON.parse(line)
    waiting.get(message.id)?.(message)
    waiting.delete(message.id)
  })
})
after(async () => {
  try {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = once(server, 'exit')
      server.stdin.end()
      await closed
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const ask = (method, params) => new Promise((done) => {
  const id = next++
  waiting.set(id, done)
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params && { params }) })}\n`)
})
const call = async (name, args) => {
  const { result } = await ask('tools/call', { name, arguments: args })
  return result
}

test('the server speaks MCP over stdio', async () => {
  const init = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } })
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  assert.deepEqual((await ask('ping')).result, {})
  assert.equal((await ask('nothing/here')).error.code, -32601)

  const { tools } = (await ask('tools/list')).result
  assert.deepEqual(tools.map((t) => t.name).sort(), ['adopt', 'audit', 'blueprint', 'create_game', 'create_package', 'deps', 'flow', 'games', 'history', 'log', 'modify', 'names', 'objects', 'overrides', 'package_compatibility', 'packages', 'play_level', 'play_task', 'preview', 'render', 'replace', 'run_reference', 'run_tests', 'search', 'seed', 'undo', 'vocabulary'])
  assert.deepEqual(tools.find((t) => t.name === 'modify').inputSchema.required, ['changeset'])
  assert.equal((await call('modify', { game: GAME })).isError, true)
})
