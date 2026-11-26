import { test } from 'node:test'
import assert from 'node:assert/strict'
import { offlineFiles, workerSource } from './offline-build.js'

test('the worker caches every built file but legacy fonts and itself, and each page by its folder', () => {
  const files = offlineFiles(['sw.js', 'index.html', 'a/index.html', 'a/content.json', 'a/assets/x-1.js', 'assets/f.woff2', 'assets/f.woff', 'assets/f.ttf'])
  assert.deepEqual(files, ['a/assets/x-1.js', 'a/content.json', 'a/index.html', 'assets/f.woff2', 'index.html', 'a/', './'])
})

test('the worker source names its version and files before the worker body', () => {
  const source = workerSource('v1', ['./'], 'globalThis.seen = [VERSION, FILES]')
  const scope = {}
  new Function('globalThis', source)(scope)
  assert.deepEqual(scope.seen, ['v1', ['./']])
})
