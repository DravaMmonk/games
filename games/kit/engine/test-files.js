import { lstatSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** Discover executable Node tests under one source directory, without following symlinks. */
export function testFiles(directory) {
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return []
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) return testFiles(file)
    return entry.isFile() && /\.test\.(js|mjs)$/.test(entry.name) ? [file] : []
  }).sort()
}

export const testArgs = (files, options = []) => [
  '--import', resolve(import.meta.dirname, 'package-imports.mjs'), '--test', ...options, ...files,
]

export function testEnv(overrides = {}) {
  const { NODE_TEST_CONTEXT: _, ...env } = process.env
  return { ...env, ...overrides }
}
