// Node and Vite resolve this public import to the caller's own catalog directory.
import { resolve, sep } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const KIT = resolve(import.meta.dirname, '..')

export function uiCatalogDirectory(importer) {
  const marker = `${sep}packages${sep}`
  const index = importer.lastIndexOf(marker)
  const owner = importer.slice(index + marker.length).split(sep)[0]
  return resolve(index < 0 ? KIT : importer.slice(0, index), ...(index < 0 ? [] : ['packages', owner]), 'i18n')
}

export function uiCatalogModule(dir, runtime) {
  const files = (existsSync(dir) ? readdirSync(dir).filter(file => file.endsWith('.json')).sort() : [])
    .map(file => [file.slice(0, -5), JSON.parse(readFileSync(resolve(dir, file), 'utf8'))])
  const catalogs = Object.fromEntries(files.map(([lang, { ui = {} }]) => [lang, ui]))
  const declarations = Object.fromEntries(files.map(([lang, entries]) => [lang, Object.fromEntries(
    Object.entries(entries).filter(([key]) => /^(kind|shape|capability)\./.test(key)),
  )]))
  return `import { uiWords, declarationWords } from ${JSON.stringify(runtime)}; export const { tr, T } = uiWords(${JSON.stringify(catalogs)}); export const readCopy = declarationWords(${JSON.stringify(declarations)}); export const uiLocales = ${JSON.stringify(Object.keys(catalogs))}`
}
