import { spawnSync } from 'node:child_process'
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

/** Keep the child process diagnostics when a package's test gate fails. */
export function packageTestFailure(files, { cwd, env, options } = {}) {
  const run = spawnSync(process.execPath, testArgs(files, options), {
    cwd, env: testEnv(env), encoding: 'utf8', maxBuffer: 64 << 20,
  })
  if (run.status === 0) return null
  const reason = run.error?.message ?? `contract tests failed (${run.signal ?? run.status})`
  return [reason, run.stdout?.trim(), run.stderr?.trim()].filter(Boolean).join('\n')
}
