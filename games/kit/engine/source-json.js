import { existsSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { isText, textEntries } from './i18n.js'
import { referenceKey } from './catalogs.js'
import { showPath } from './ops/edit.js'
import { readJSON } from './release-data.js'

/** Check raw files independently of the schemas and of the content loader's public surface. */
export function sourceJsonProblems(root, directories) {
  const problems = []
  function visit(value, file, path = []) {
    if (!value || typeof value !== 'object') return
    if (isText(value)) {
      const entries = textEntries(value)
      // Port names may also be language codes, and their labels are catalog references.
      const pair = entries.length > 1 && (
        (Object.hasOwn(value, 'zh') && Object.hasOwn(value, 'en')) || entries.some(([, text]) => !referenceKey(text))
      )
      if (!pair) return
      problems.push(`${file}: ${showPath(path) || '(root)'}: store inline translations in i18n and use an @key reference`)
      return
    }
    for (const [key, child] of Object.entries(value)) visit(child, file, [...path, Array.isArray(value) ? Number(key) : key])
  }
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', 'output', '.git'].includes(entry.name) && !(dir === resolve(root, 'site') && entry.name.startsWith('dist'))) scan(path)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        const file = relative(root, path)
        try { visit(readJSON(path), file) }
        catch (error) { problems.push(`${file}: ${error.message}`) }
      }
    }
  }
  for (const dir of directories) if (existsSync(dir)) scan(dir)
  return problems
}
