import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assetSignature, cleanRefreshURL, recoveryURL, refreshURL, releaseChanged } from './release.js'

const base = 'https://example.test/games/vision/index.html?level=3-6'
const doc = (paths) => ({
  querySelectorAll: () => paths.map(([tagName, value]) => ({
    tagName, getAttribute: name => ({ SCRIPT: { src: value }, LINK: { href: value } })[tagName][name],
  })),
})
const original = [['SCRIPT', './assets/game-old.js'], ['LINK', './assets/game-old.css']]
const newer = [['SCRIPT', './assets/game-new.js'], ['LINK', './assets/game-old.css']]
const assets = assetSignature(doc(original), base)
const parse = (html) => doc(JSON.parse(html))

test('release detection fetches both assets uncached and requires both responses to be valid', async () => {
  const pageURL = 'https://example.test/games/vision/index.html'
  const dataURL = 'https://example.test/games/vision/content.json'
  const check = async ({ page = original, data = '{"v":1}', unavailable }) => {
    const calls = []
    const responses = new Map([[pageURL, JSON.stringify(page)], [dataURL, data]])
    const fetcher = async (url, options) => {
      calls.push([url.href, options.cache])
      if (unavailable === 'network') throw new Error('offline')
      return { ok: responses.has(url.href) && url.href !== unavailable, text: async () => responses.get(url.href) }
    }
    const changed = await releaseChanged({ base, assets, content: '{"v":1}', fetcher, parse })
    assert.deepEqual(calls, [[pageURL, 'no-store'], [dataURL, 'no-store']])
    return changed
  }
  assert.equal(await check({}), false)
  assert.equal(await check({ page: newer }), true)
  assert.equal(await check({ data: '{"v":2}' }), true)
  assert.equal(await check({ page: newer, data: '<html>error</html>' }), false)
  assert.equal(await check({ data: '{"v":2}', unavailable: pageURL }), false)
  assert.equal(await check({ page: newer, unavailable: dataURL }), false)
  assert.equal(await check({ unavailable: 'network' }), false)
})

test('refresh returns to the map and keeps other URL parameters', () => {
  const url = refreshURL(`${base}&lang=zh#x`, 42)
  assert.equal(url, 'https://example.test/games/vision/index.html?lang=zh&_refresh=42#x')
  assert.equal(cleanRefreshURL(url), 'https://example.test/games/vision/index.html?lang=zh#x')
})

test('startup recovery preserves the link, retries a newer build once, and ignores unrelated failures', async () => {
  const link = `${base}&lang=zh#x`
  const retry = 'https://example.test/games/vision/index.html?level=3-6&lang=zh&_refresh=42#x'
  const recover = (options) => recoveryURL({ base: link, assets, parse, now: 42, ...options })
  const serve = (paths) => async (url, options) => {
    assert.equal(url.href, retry)
    assert.equal(options.cache, 'no-store')
    return { ok: true, text: async () => JSON.stringify(paths) }
  }
  assert.equal(await recover({ fetcher: serve(newer) }), retry)
  assert.equal(await recover({ fetcher: serve(original) }), null)
  assert.equal(await recover({ fetcher: serve([]) }), null)
  assert.equal(await recover({ fetcher: async () => { throw new Error('offline') } }), null)
  let requested = false
  assert.equal(await recover({ base: retry, fetcher: () => { requested = true } }), null)
  assert.equal(requested, false)
})
