import { dependencyIds } from './release-data.js'
import { packageDirectory, packageConfig, packageIds } from './resolver.js'
import { exportedNames } from './manifests.js'
// Import policy is shared by ESLint and the headless content checker.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { createRequire, registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const KIT = resolve(import.meta.dirname, '..')
export const publicEntries = { kernel: resolve(KIT, 'engine/index.js'), 'kernel/view': resolve(KIT, 'app/view.jsx') }
const packageLocations = new Map(), packageRoots = new Map()
export function registerPackageLocation(id, dir, root) {
  packageLocations.set(`${root}:${id}`, dir)
  packageRoots.set(dir, root)
  if (existsSync(dir)) packageRoots.set(realpathSync(dir), root)
}
const location = (id, root) => packageLocations.get(`${root}:${id}`) ?? packageDirectory(id, root)
export function exportPath(specifier, root) {
  if (publicEntries[specifier]) return publicEntries[specifier]
  if (!/^[a-z][a-z0-9-]*(?:\/view)?$/.test(specifier)) return null
  const [id, view] = specifier.split('/')
  const path = resolve(location(id, root), view ? 'view/index.jsx' : 'core/index.js')
  return existsSync(path) ? path : null
}
export function importProblem(specifier, file, root, uses) {
  const parts = file.slice(file.lastIndexOf(`${sep}packages${sep}`) + 10).split(sep)
  const [id, side] = parts
  if (!['core', 'view'].includes(side)) return null
  if (typeof specifier !== 'string') return 'computed imports are not allowed in package code'
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(file), specifier)
    const base = existsSync(location(id, root)) ? realpathSync(location(id, root)) : location(id, root)
    if (!target.startsWith(location(id, root) + sep) && !target.startsWith(base + sep)) return 'packages may only import public kernel and dependency exports'
    const actual = existsSync(target) ? realpathSync(target) : target
    const allowed = [resolve(base, side) + sep, ...(side === 'view' ? [resolve(base, 'core') + sep] : [])]
    const ownDeclaration = ['kinds', 'shapes', 'capabilities'].some(folder => dirname(actual) === resolve(base, folder)) && extname(actual) === '.json'
    if (!ownDeclaration && !allowed.some(path => actual.startsWith(path))) return `${side} cannot import ${specifier}`
    if (side === 'core' && !['.js', '.mjs', '.json'].includes(extname(target))) return 'core cannot import JSX, CSS or view assets'
    return null
  }
  if (specifier === 'kernel' || side === 'view' && ['kernel/view', 'react', 'react/jsx-runtime', 'react-dom', 'lucide-react'].includes(specifier)) return null
  const [owner, suffix, ...rest] = specifier.split('/')
  if (uses.includes(owner) && !rest.length && (!suffix || suffix === 'view' && side === 'view') && exportPath(specifier, root)) return null
  return `${side}: undeclared or private import ${specifier}`
}
const walkFiles = dir => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkFiles(resolve(dir, entry.name)) : [resolve(dir, entry.name)])
const parsedImports = new Map()

function parseCode(source, jsx) {
  const require = createRequire(resolve(KIT, '../../site/package.json'))
  const { parse } = require('espree')
  const sources = [], imports = []
  try {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx } })
    const visit = node => {
      if (!node || typeof node !== 'object') return
      let source
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) source = node.source
      if (node.type === 'ImportExpression') source = node.source
      if (node.type === 'CallExpression' && node.callee?.name === 'require') source = node.arguments[0] ?? {}
      if (source) sources.push(source.type === 'Literal' ? source.value : null)
      if (source?.type === 'Literal' && typeof source.value === 'string') {
        const names = node.type === 'ImportDeclaration' ? node.specifiers.map(specifier =>
          specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported?.name ?? '*')
          : node.type === 'ExportNamedDeclaration' ? node.specifiers.map(specifier => specifier.local.name)
            : ['*']
        imports.push({ from: source.value, names })
      }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value)
    }
    visit(ast)
  } catch (error) {
    return { error: `${error.lineNumber}:${error.column} ${error.message}` }
  }
  return { sources, imports }
}

function fileProblems(file, root, uses, side, parsed) {
  if (side === 'core' && extname(file) === '.jsx') return ['core contains JSX']
  if (parsed.error) return [parsed.error]
  if (side === 'test') return []
  // Recheck dependency authority and export availability even when the source is unchanged.
  return parsed.sources.map(source => importProblem(source, file, root, uses)).filter(Boolean)
}

/** Check an edited file's syntax and import boundaries before writing it. */
export function packageSourceProblems(id, root, path, source) {
  const side = path.split('/')[0]
  const file = resolve(packageDirectory(id, root), path)
  const uses = dependencyIds(packageConfig(id, root))
  return fileProblems(file, root, uses, side, parseCode(source, side !== 'core'))
}

export function packageCodeProblems(id, root) {
  const dir = location(id, root)
  const uses = dependencyIds(packageConfig(id, root))
  const problems = []
  for (const side of ['core', 'view']) for (const file of walkFiles(resolve(dir, side))) {
    if (!/\.(js|jsx|mjs)$/.test(file)) { if (side === 'core' && /\.(css|tsx)$/.test(file)) problems.push({ at: file, says: 'core contains view code' }); continue }
    const stat = statSync(file)
    const stamp = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`
    let entry = parsedImports.get(file)
    if (entry?.stamp !== stamp) {
      entry = { stamp, parsed: parseCode(readFileSync(file, 'utf8'), side === 'view') }
      parsedImports.set(file, entry)
    }
    for (const says of fileProblems(file, root, uses, side, entry.parsed)) problems.push({ at: relative(root, file), says })
  }
  return problems
}

/** Find entry exports without a production consumer or an explicit extension-point declaration. */
export function packageExportWarnings(root) {
  const ids = packageIds(root)
  const used = new Map()
  for (const id of ids) for (const side of ['core', 'view']) {
    for (const file of walkFiles(resolve(packageDirectory(id, root), side)).filter(file => /\.(js|jsx|mjs)$/.test(file))) {
      const parsed = parsedImports.get(file)?.parsed ?? parseCode(readFileSync(file, 'utf8'), side === 'view')
      for (const { from, names } of parsed.imports ?? []) {
        const [owner] = from.split('/')
        if (owner === id || !ids.includes(owner)) continue
        const namesUsed = used.get(from) ?? new Set()
        for (const name of names) namesUsed.add(name)
        used.set(from, namesUsed)
      }
    }
  }
  return ids.flatMap(id => Object.entries({ core: id, view: `${id}/view` }).flatMap(([side, entry]) => {
    const consumers = used.get(entry) ?? new Set()
    const extensionPoints = packageConfig(id, root).extensionPoints?.[side] ?? []
    return exportedNames(exportPath(entry, root)).filter(name => name !== 'register' && !consumers.has('*') && !consumers.has(name) && !extensionPoints.includes(name))
      .map(name => `${id}/${side}: unused export ${name}`)
  }))
}

// Node's hooks keep bare package names identical to the Vite public export map.
let installed = false
export function installPackageImports() {
  if (installed) return
  installed = true
  registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.startsWith('file:')) {
      const parent = fileURLToPath(context.parentURL)
      const marker = `${sep}packages${sep}`, index = parent.lastIndexOf(marker)
      if (index >= 0) {
        const root = [...packageRoots].find(([dir]) => parent.startsWith(dir + sep))?.[1] ?? parent.slice(0, index)
        const path = exportPath(specifier, root)
        if (path) return next(pathToFileURL(path).href, context)
      }
    }
    return next(specifier, context)
  } })
}
