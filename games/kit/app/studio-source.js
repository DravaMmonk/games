import { T as catalogText } from 'kernel/words'
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { packageDirectory, readCatalogs } from '../engine/resolver.js'
import { packageWords } from '../engine/manifests.js'
import { packageSourceProblems } from '../engine/plugin-boundaries.js'
import { testArgs, testEnv, testFiles } from '../engine/test-files.js'

const sourcePath = /^(?:core|view|test)(?:\/[\w-][\w.-]*)*\/[\w-][\w.-]*\.(?:js|jsx|mjs)$/
const sides = ['core', 'view', 'test']
const stat = file => lstatSync(file, { throwIfNoEntry: false })
const revision = text => createHash('sha256').update(text).digest('hex')
const run = promisify(execFile)

function packageSourceDirectory(root, id) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid package ID.')
  const dir = packageDirectory(id, root)
  if (!stat(dirname(dir))?.isDirectory() || !stat(dir)?.isDirectory() || !stat(resolve(dir, 'package.json'))?.isFile()) {
    throw new Error('Source is only available for workspace packages.')
  }
  return dir
}

function sourceFile(dir, path) {
  if (typeof path !== 'string' || !sourcePath.test(path)) throw new Error('Use a JavaScript path inside core/, view/ or test/.')
  const segments = path.split('/')
  if (segments.includes('node_modules')) throw new Error('Invalid source path.')
  let file = dir
  for (const [index, name] of segments.entries()) {
    file = resolve(file, name)
    const entry = stat(file)
    if (entry && !(index === segments.length - 1 ? entry.isFile() : entry.isDirectory())) throw new Error('Invalid source path.')
  }
  return file
}

function sourceFiles(dir, path) {
  const folder = resolve(dir, path)
  if (!stat(folder)?.isDirectory()) return []
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const name = `${path}/${entry.name}`
    if (entry.isDirectory() && /^[\w-][\w.-]*$/.test(entry.name) && entry.name !== 'node_modules') return sourceFiles(dir, name)
    return entry.isFile() && sourcePath.test(name) ? [name] : []
  })
}

export function sourceTools(root, onSave = () => {}) {
  return {
    source_packages: {
      about: catalogText("列出本地源码包。"),
      params: {},
      run() {
        const dir = packageDirectory('', root)
        if (!stat(dir)?.isDirectory()) return []
        return readdirSync(dir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/.test(entry.name) && stat(resolve(dir, entry.name, 'package.json'))?.isFile())
          .map(entry => entry.name).sort().map(id => {
            const packageDir = resolve(dir, id)
            const config = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
            return { id, ...packageWords({ id, config, catalogs: readCatalogs(resolve(packageDir, 'i18n')) }) }
          })
      },
    },
    source_list: {
      about: catalogText("列出包的 JavaScript 源文件。"),
      params: { package: 'string', symbol: 'string?' },
      run({ package: id, symbol }) {
        const dir = packageSourceDirectory(root, id)
        const files = sides.flatMap(side => sourceFiles(dir, side)).sort()
        if (typeof symbol !== 'string' || !/^[\w-]+$/.test(symbol)) return { files, matches: [] }
        const token = new RegExp(`(?<![\\w-])${symbol}(?![\\w-])`)
        const declaration = new RegExp(`^[ \\t]*['"]?${symbol}['"]?\\s*:`, 'm')
        const matches = files.flatMap(path => {
          const text = readFileSync(resolve(dir, path), 'utf8')
          if (!token.test(text)) return []
          const rank = declaration.test(text) ? 0 : text.includes(`${id}/${symbol}`) ? 1 : 2
          return [{ path, rank }]
        }).sort((left, right) => left.rank - right.rank).map(({ path }) => path)
        return { files, matches }
      },
    },
    source_read: {
      about: catalogText("读取源码和文件版本。"),
      params: { package: 'string', path: 'string' },
      run({ package: id, path }) {
        const text = readFileSync(sourceFile(packageSourceDirectory(root, id), path), 'utf8')
        return { text, revision: revision(text) }
      },
    },
    source_save: {
      about: catalogText("校验并保存包源码。"),
      params: { package: 'string', path: 'string', text: 'string', base: 'string or null' },
      async run({ package: id, path, text, base }) {
        const file = sourceFile(packageSourceDirectory(root, id), path)
        if (typeof text !== 'string' || !(base === null || typeof base === 'string')) throw new Error('Invalid source text or revision.')
        const problems = packageSourceProblems(id, root, path, text)
        if (problems.length) throw new Error(problems.join('\n'))
        const current = stat(file) ? readFileSync(file, 'utf8') : null
        if (base !== (current === null ? null : revision(current))) throw new Error('The file changed on disk. Reload it before saving.')
        mkdirSync(dirname(file), { recursive: true })
        const temporary = `${file}.${randomUUID()}.tmp`
        try {
          writeFileSync(temporary, text, { flag: 'wx', mode: stat(file)?.mode })
          if (base === null) linkSync(temporary, file)
          else renameSync(temporary, file)
        } catch (error) {
          if (error.code === 'EEXIST') throw new Error('The file changed on disk. Reload it before saving.')
          throw error
        } finally {
          rmSync(temporary, { force: true })
        }
        await onSave(file)
        return { text, revision: revision(text) }
      },
    },
    source_check: {
      about: catalogText("用新进程检查包并运行包测试。"),
      params: { package: 'string' },
      async run({ package: id }) {
        const dir = packageSourceDirectory(root, id)
        const options = { cwd: root, env: testEnv({ GAMES_ROOT: root }), maxBuffer: 8 * 1024 * 1024 }
        const output = []
        try {
          const check = await run(process.execPath, [resolve(import.meta.dirname, '../engine/check.js'), '--package', id, '--fresh'], options)
          output.push(check.stdout, check.stderr)
          const tests = testFiles(resolve(dir, 'test'))
          if (tests.length) {
            const result = await run(process.execPath, testArgs(tests), options)
            output.push(result.stdout, result.stderr)
          }
          return { ok: true, output: output.join('').trim() }
        } catch (error) {
          return { ok: false, output: [...output, error.stdout, error.stderr].filter(Boolean).join('').trim() || error.message }
        }
      },
    },
  }
}

/** The code-writing API is for the loopback Studio and accepts same-origin JSON only. */
export function localSourceRequest(req) {
  const host = req.headers.host ?? ''
  const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)
  const origin = req.headers.origin
  return loopback && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && (!origin || origin === `http${req.socket.encrypted ? 's' : ''}://${host}`)
    && req.headers['content-type']?.split(';')[0] === 'application/json'
}
