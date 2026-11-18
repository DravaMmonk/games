import { T as catalogText } from 'kernel/words'
import { packageEntries } from '../engine/plugin-node.js'
import { packageApp } from './package-vite.js'
import { localSourceRequest, sourceTools } from './studio-source.js'
import { packageIds } from '../engine/resolver.js'
// The studio's server side (games/design/README.md 6.7), a Vite plugin for the dev server (npm run studio): the tools the
// MCP server offers (../engine/ops/tools.js) as HTTP endpoints, and the module that gives the studio's page every
// package's plugin entries. Content writes use the same operation set as MCP. Local source editing has its own
// file tools, with the package import policy and the same package checks.
//
//   GET  /studio/api/              the tools: { name: { about, params } }
//   POST /studio/api/packages       {} → installed packages
//   POST /studio/api/preview        { package, changeset?, check? } → package objects and pending changes
//   POST /studio/api/play_level     { package, level, changeset? } → { content } single-level runtime shell
//   POST /studio/api/modify         { package, changeset, dryRun?, base? } → checked write to that package
//   POST /studio/api/<tool>        the tool's arguments as a JSON body → its result as JSON (an error: { error })
//
// Calls are answered one at a time, in order, as the MCP server answers them: a changeset sees the files the one
// before it wrote. The slow ones — a whole check (preview with check, which runs every reference of a big game for
// seconds), a run of a level's tests — go to a second worker lane with its own copy of the tools, so a quick
// preview never waits behind them; a call that writes waits for both lanes. GAMES_ROOT points the tools at a copy of
// the games folder.
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { eraLevels } from '../course.js'
import { contentRoot, contentTargets, readContent } from '../engine/resolver.js'

const PREFIX = '/studio/api/'
const MODULE = 'virtual:studio-domains'

const courseCatalog = {
  about: catalogText("列出其他游戏中已编排的关卡，供跨游戏先修引用。"),
  params: { game: 'string' },
  async run({ game }) {
    const root = contentRoot()
    return contentTargets([], root, { game: true }).filter(({ id }) => id !== game).map(({ id }) => {
      const content = readContent(id, root)
      const placed = new Set((content.eras ?? []).flatMap(eraLevels))
      return { game: id, title: content.title, levels: content.levels.filter(({ id }) => placed.has(id)).map(({ id, title }) => ({ id, title })) }
    })
  },
}

/** Whether a call is a slow read (it goes to the second lane), and whether it writes (it waits for both). */
export const slow = (name, args) => (name === 'preview' && args.check !== false) || name === 'run_tests'
const writes = (name, args) => (['modify', 'undo', 'adopt'].includes(name) && !args.dryRun) || ['create_game', 'create_package', 'source_save'].includes(name) || (name === 'blueprint' && args.text !== undefined && !args.dryRun)

/** The tools in a worker thread, with a fresh module cache when the lane is replaced. run(name, args) → the result, or throws the tool's error. */
export function worker() {
  const thread = new Worker(new URL('./studio-worker.js', import.meta.url))
  const waiting = new Map()
  let next = 0
  let failure
  thread.on('message', ({ id, result, error }) => {
    const call = waiting.get(id)
    waiting.delete(id)
    if (error !== undefined) call.reject(new Error(error))
    else call.resolve(result)
  })
  // A thread that dies fails what it was asked; the next call meets the error too, never a hang.
  const failAll = error => {
    failure = error
    for (const call of waiting.values()) call.reject(error)
    waiting.clear()
  }
  thread.on('error', failAll)
  const closed = new Promise(resolve => thread.once('exit', code => {
    failAll(failure ?? new Error(`Studio worker exited (${code}).`))
    resolve()
  }))
  return {
    run: (name, args) => new Promise((done, fail) => {
      if (failure) return fail(failure)
      next += 1
      waiting.set(next, { resolve: done, reject: fail })
      thread.postMessage({ id: next, name, args })
    }),
    close: () => {
      if (!failure) thread.postMessage({ close: true })
      return closed
    },
  }
}

/** The bridge over `tools` (name → { about, params, run(args) }), as connect middleware; `aside`: the second lane. */
export function bridge(tools, lacking, aside = null) {
  let queue = Promise.resolve()
  let side = Promise.resolve()
  return (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith(PREFIX)) return next()
    const reply = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(body))
    }
    const name = url.pathname.slice(PREFIX.length)
    if (!name && req.method === 'GET') return reply(200, Object.fromEntries(Object.entries(tools).map(([k, t]) => [k, { about: t.about, params: t.params }])))
    const tool = tools[name]
    if (!tool) return reply(404, { error: `no tool ${name}; the tools are ${Object.keys(tools).join(', ')}` })
    if (req.method !== 'POST') return reply(405, { error: `POST ${name}’s arguments as JSON` })
    if (name.startsWith('source_') && !localSourceRequest(req)) return reply(403, { error: 'Package source tools require same-origin JSON on the local Studio.' })
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let args
      try {
        args = body ? JSON.parse(body) : {}
      } catch {
        return reply(400, { error: 'the body is not JSON' })
      }
      const absent = lacking(tool, args)
      if (absent.length) return reply(400, { error: `${name} needs ${absent.join(', ')}` })
      const answer = async (run) => {
        try {
          reply(200, await run())
        } catch (error) {
          reply(422, { error: error.message })
        }
      }
      if (aside && slow(name, args)) {
        side = Promise.all([side, queue]).then(() => answer(() => aside.run(name, args)))
        return
      }
      const before = writes(name, args) ? Promise.all([queue, side]) : queue
      queue = before.then(() => answer(() => tool.run(args)))
    })
  }
}

/** The plugin: the bridge on the dev server, and `virtual:studio-domains` ({ domain: () => import(its game.js) }). */
export function studioApp() {
  const root = contentRoot()
  const packages = packageApp(root)
  return {
    name: 'studio',
    resolveId: (id, importer) => (id === MODULE ? `\0${id}` : packages.resolveId(id, importer)),
    load(id) {
      if (id !== `\0${MODULE}`) return null
      let code
      try {
        code = packageEntries(packageIds(root).map(id => ({ id })), root)
      } catch (error) {
        // Preserve the loader diagnostic for the browser's source-recovery view.
        return `throw new Error(${JSON.stringify(error.message)})`
      }
      return `import { loadGame } from ${JSON.stringify(resolve(import.meta.dirname, 'load-game.js'))}
export const PACKAGES = { ${code.filter(entry => entry.core || entry.view).map(entry => `${JSON.stringify(entry.id)}: async () => ({ ${['core', 'view'].filter(side => entry[side]).map(side => `${side}: await import(${JSON.stringify(entry[side])})`).join(', ')} })`).join(', ')} }
export const defineContent = content => loadGame(content, PACKAGES)`
    },
    async configureServer(server) {
      const { TOOLS, lacking } = await import('../engine/ops/tools.js')
      let fast
      let lane
      const tools = Object.fromEntries(Object.entries(TOOLS).map(([name, tool]) => [name, { ...tool, run: args => (fast ??= worker()).run(name, args) }]))
      const refreshCode = async file => {
        const timestamp = Date.now()
        for (const path of new Set([file, realpathSync(file)])) {
          for (const module of server.moduleGraph.getModulesByFile(path) ?? []) server.moduleGraph.invalidateModule(module, new Set(), timestamp, true)
        }
        const old = [fast, lane].filter(Boolean)
        fast = lane = undefined
        for (const id of [MODULE, 'virtual:package-displays']) {
          const module = server.moduleGraph.getModuleById(`\0${id}`)
          if (module) server.moduleGraph.invalidateModule(module, new Set(), timestamp, true)
        }
        await Promise.all(old.map(worker => worker.close()))
      }
      const host = server.config.server.host
      const source = !host || ['localhost', '127.0.0.1', '::1'].includes(host) ? sourceTools(root, refreshCode) : {}
      server.middlewares.use(bridge({ ...tools, course_catalog: courseCatalog, ...source }, lacking, { run: (name, args) => (lane ??= worker()).run(name, args) }))
      server.httpServer?.on('close', () => {
        fast?.close()
        lane?.close()
      })
    },
  }
}
