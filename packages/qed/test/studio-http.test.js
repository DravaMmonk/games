// Exercise the Studio HTTP transport, including one real package write and undo.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { bridge } from '../../../games/kit/app/studio.js'
import { proofsRoot } from './fixture.js'

const { root, id: GAME } = proofsRoot()
let base
let server

async function listen(middleware) {
  const server = createServer((req, res) => middleware(req, res, () => {
    res.statusCode = 404
    res.end('not the bridge')
  }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server
}

const origin = server => `http://127.0.0.1:${server.address().port}`
async function close(server) {
  if (!server) return
  const closed = once(server, 'close')
  server.close()
  await closed
}

before(async () => {
  process.env.GAMES_ROOT = root
  const { TOOLS, lacking } = await import('../../../games/kit/engine/ops/tools.js')
  server = await listen(bridge(TOOLS, lacking))
  base = origin(server)
})
after(async () => {
  try {
    await close(server)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const post = async (tool, args, raw = null) => {
  const res = await fetch(`${base}/studio/api/${tool}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(args) })
  return { status: res.status, body: await res.json() }
}
const onDisk = file => readFileSync(join(root, 'packages', GAME, file), 'utf8')

test('the bridge lists the tools, and says what is wrong with a call', async () => {
  const list = await (await fetch(`${base}/studio/api/`)).json()
  assert.ok(['preview', 'modify', 'seed', 'undo', 'log', 'vocabulary'].every((t) => list[t]?.about))
  assert.equal((await fetch(`${base}/elsewhere`)).status, 404)
  assert.equal((await post('nothing', {})).status, 404)
  assert.equal((await fetch(`${base}/studio/api/preview`)).status, 405)
  assert.deepEqual(await post('preview', {}), { status: 400, body: { error: 'preview needs game or package' } })
  assert.equal((await post('preview', null, '{not json')).status, 400)
  const unknown = await post('preview', { game: 'nope' })
  assert.equal(unknown.status, 422)
  assert.match(unknown.body.error, /no game nope/)
  assert.equal((await post('preview', { game: GAME, package: GAME })).status, 422)
})

test('apply, read the log, undo: the content comes back as it was', async () => {
  const before = onDisk('i18n/en.json')
  const source = onDisk('levels/given.json')
  const ops = [{ op: 'text.set', level: 'given', path: 'tasks[0].brief', lang: 'en', value: 'Assume “Today is Saturday” and prove the claim.' }]
  const done = (await post('modify', { package: GAME, changeset: { why: 'a shorter brief', ops } })).body
  assert.equal(done.written, true, done.problems.join('\n'))
  assert.notEqual(onDisk('i18n/en.json'), before)
  assert.equal(onDisk('levels/given.json'), source)
  const { log, undoable } = (await post('log', { package: GAME })).body
  assert.equal(log.at(-1).why, 'a shorter brief')
  assert.equal(undoable, log.at(-1).seq)
  const undone = (await post('undo', { package: GAME })).body
  assert.equal(undone.written, true, undone.problems.join('\n'))
  // The same content; a line the change rewrote keeps the file format (../engine/ops/json.js), as every write does.
  assert.deepEqual(JSON.parse(onDisk('i18n/en.json')), JSON.parse(before))
  assert.equal((await post('log', { package: GAME })).body.undoable, null, 'an undo is not itself undone')
})

test('the slow reads go to the second lane: a quick preview is not held up by a whole check, a write waits for both', async t => {
  const done = []
  const later = (ms, what) => new Promise((ok) => setTimeout(() => { done.push(what); ok({ what }) }, ms))
  const tools = Object.fromEntries(['preview', 'modify', 'names'].map((name) => [name, { about: name, params: {}, run: (args) => later(5, `${name}${args.check === false ? ' quick' : ''}`) }]))
  const aside = { run: (name) => later(120, `${name} aside`) }
  const lane = await listen(bridge(tools, () => [], aside))
  t.after(() => close(lane))
  const at = origin(lane) + '/studio/api/'
  const send = (tool, args) => fetch(at + tool, { method: 'POST', body: JSON.stringify(args) }).then((r) => r.json())
  const answers = await Promise.all([send('preview', { game: 'g' }), send('preview', { game: 'g', check: false }), send('names', {}), send('modify', {})])
  assert.deepEqual(answers.map((a) => a.what), ['preview aside', 'preview quick', 'names', 'modify'])
  assert.deepEqual(done, ['preview quick', 'names', 'preview aside', 'modify'], 'the quick calls answer while the check runs; the write waits for it')
})
