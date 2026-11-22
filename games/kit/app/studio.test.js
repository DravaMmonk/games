import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import { bridge } from './studio.js'

test('Studio previews and writes can finish while the course audit worker is busy', { timeout: 3000 }, async () => {
  const auditStarted = Promise.withResolvers()
  const auditFinished = Promise.withResolvers()
  const middleware = bridge({
    preview: { run: () => 'quick preview' },
    modify: { run: () => 'applied' },
  }, () => [], { run: () => 'runtime check' }, {
    run: () => {
      auditStarted.resolve()
      return auditFinished.promise
    },
  })
  const post = (name, args) => new Promise(resolve => {
    const request = Object.assign(Readable.from([JSON.stringify(args)]), { url: `/studio/api/${name}`, method: 'POST' })
    middleware(request, { setHeader() {}, end: body => resolve(JSON.parse(body)) }, assert.fail)
  })

  const auditing = post('preview', { courseAudit: true })
  await auditStarted.promise
  try {
    assert.equal(await post('preview', { check: false }), 'quick preview')
    assert.equal(await post('preview', {}), 'runtime check')
    assert.equal(await post('modify', {}), 'applied')
  } finally {
    auditFinished.resolve('course audit')
  }
  assert.equal(await auditing, 'course audit')
})

test('a background tool is answered while a write is under way and holds nothing up', { timeout: 3000 }, async () => {
  const writing = Promise.withResolvers()
  const advising = Promise.withResolvers()
  const middleware = bridge({
    modify: { run: () => writing.promise },
    preview: { run: () => 'quick preview' },
    advisories: { background: true, run: () => advising.promise },
  }, () => [])
  const post = (name, args) => new Promise(resolve => {
    const request = Object.assign(Readable.from([JSON.stringify(args)]), { url: `/studio/api/${name}`, method: 'POST' })
    middleware(request, { setHeader() {}, end: body => resolve(JSON.parse(body)) }, assert.fail)
  })
  const advised = post('advisories', {})
  const written = post('modify', {})
  const previewed = post('preview', { check: false })
  writing.resolve('applied')
  assert.equal(await written, 'applied')
  assert.equal(await previewed, 'quick preview')
  advising.resolve('advice')
  assert.equal(await advised, 'advice')
})
