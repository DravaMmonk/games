import { contentRoot } from './resolver.js'
import { contentRoots, contentSchemas } from './content.js'
import { packageApp } from '../app/package-vite.js'
// A game's whole definition (the shell's levels, reference panels and encyclopedia), made under node for the checks from its
// content (content.js): its domain's game.js loaded through vite, as the build loads it, with the few browser globals
// the games touch at import time stubbed. vite and the games' packages are site's, wherever node runs from.
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runtimeIds } from './runtime.js'

const ROOT = resolve(import.meta.dirname, '../../../site')
const KIT_DIR = resolve(import.meta.dirname, '..')

const noop = () => {}
const memory = new Map()
const stubs = {
  window: globalThis, addEventListener: noop, removeEventListener: noop, requestAnimationFrame: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  localStorage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) },
  document: { documentElement: { dataset: {}, lang: 'zh' }, querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, createElement: () => ({ style: {} }), head: { appendChild: noop } },
  customElements: { get: () => true, define: noop }, HTMLElement: class {},
}
for (const [k, v] of Object.entries(stubs)) if (!(k in globalThis)) globalThis[k] = v

const from = createRequire(resolve(ROOT, 'package.json'))
const servers = new Map()

/** Load from the workspace's server so the module shares its game and plugin instances. */
export async function loadModule(file, root = contentRoot()) {
  const server = await serve(root)
  return server.ssrLoadModule(file)
}

/** The game made from `content` as the shell gets it (its domain's game.js over it). */
export async function gameOf(content, { view = false } = {}) {
  const root = contentRoots.get(content) ?? contentRoot()
  const server = await serve(root)
  const plugins = (await import('./plugin-node.js')).loadPlugins
  const kernel = await plugins(content, root, file => server.ssrLoadModule(file), true)
  const { pluginGame } = await server.ssrLoadModule(resolve(KIT_DIR, 'app/plugin-game.jsx'))
  const vocabulary = contentSchemas.get(content)
  const modules = runtimeIds(content).map(id => pluginGame(id, kernel, vocabulary, { view }))
  const { composeGame, configureGame } = await server.ssrLoadModule(resolve(KIT_DIR, 'app/compose-game.js'))
  const game = composeGame(content, modules)
  return configureGame(game, content, kernel)
}

function serve(root) {
  if (!servers.has(root)) {
    const opening = createGameServer(root).catch(error => {
      if (servers.get(root) === opening) servers.delete(root)
      throw error
    })
    servers.set(root, opening)
  }
  return servers.get(root)
}

async function createGameServer(root) {
  const { createServer } = await import(pathToFileURL(from.resolve('vite')).href)
  const react = (await import(pathToFileURL(from.resolve('@vitejs/plugin-react')).href)).default
  return createServer({
    root: ROOT, configFile: false, plugins: [react(), packageApp(root)], appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false, fs: { allow: ['..'] } },
    resolve: { dedupe: ['react', 'react-dom', 'lucide-react', 'katex'] }, ssr: { noExternal: ['katex'] }, optimizeDeps: { noDiscovery: true, include: [] },
  })
}

export async function closeGames() {
  const open = [...servers.values()]
  servers.clear()
  await Promise.all(open.map(async pending => (await pending.catch(() => null))?.close()))
}
