// Make the built site playable offline and installable: its web app manifest and icon, and the service worker
// (./offline-worker.js) given the list of files to cache and a version that changes whenever any of them does.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const PAPER = '#f3f1eb'
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#282824"/><path d="M32 64V32H64" fill="#c98f22"/></svg>\n`
const MANIFEST = {
  name: '图灵模拟器 · Turing Simulator',
  short_name: '图灵模拟器',
  lang: 'zh-CN',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: PAPER,
  theme_color: PAPER,
  icons: [{ src: 'icon.svg', sizes: 'any' }],
}
const WORKER = 'sw.js'
// KaTeX ships .woff and .ttf beside .woff2; every browser with service workers reads .woff2.
const LEGACY_FONT = /\.(?:ttf|woff)$/

/** What the worker caches, relative to the site's root: every built file but legacy fonts, and each page's folder. */
export function offlineFiles(paths) {
  const files = paths.filter((path) => path !== WORKER && !LEGACY_FONT.test(path)).sort()
  const folders = files.filter((path) => /(?:^|\/)index\.html$/.test(path)).map((path) => path.slice(0, -'index.html'.length) || './')
  return [...files, ...folders]
}

/** The worker's source: its version and file list, then ./offline-worker.js. */
export function workerSource(version, files, body) {
  return `const VERSION = ${JSON.stringify(version)}\nconst FILES = ${JSON.stringify(files)}\n${body}`
}

export function writeOffline(dist) {
  writeFileSync(resolve(dist, 'manifest.webmanifest'), `${JSON.stringify(MANIFEST, null, 2)}\n`)
  writeFileSync(resolve(dist, 'icon.svg'), ICON)
  const paths = readdirSync(dist, { recursive: true }).filter((path) => statSync(resolve(dist, path)).isFile()).map((path) => path.split(sep).join('/'))
  const files = offlineFiles(paths)
  const hash = createHash('sha256')
  for (const file of files.filter((path) => !path.endsWith('/') && path !== './')) hash.update(file).update(readFileSync(resolve(dist, file)))
  const body = readFileSync(resolve(import.meta.dirname, 'offline-worker.js'), 'utf8')
  writeFileSync(resolve(dist, WORKER), workerSource(hash.digest('hex').slice(0, 16), files, body))
  return files.length
}
