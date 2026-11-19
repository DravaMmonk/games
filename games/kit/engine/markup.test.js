import test from 'node:test'
import assert from 'node:assert/strict'
import { markupOf } from './markup.js'

test('authored markup parses emphasis and references and keeps plain comparisons', () => {
  assert.deepEqual(markupOf('a <b>bold <i>and</i></b> <level-ref to="x"></level-ref>, a < b').nodes, [
    'a ', { tag: 'b', kids: ['bold ', { tag: 'i', kids: ['and'] }] }, ' ', { ref: 'level', to: 'x' }, ', a < b',
  ])
})

test('unsupported tags stay literal and invalid emphasis reports the problem', () => {
  assert.match(markupOf('<script>alert(1)</script>').problems[0], /<script> is no markup/)
  assert.deepEqual(markupOf('<img src=x onerror=alert(1)>').nodes, ['<img src=x onerror=alert(1)>'])
  assert.match(markupOf('<b onclick="x">hi</b>').problems[0], /takes no attributes/)
  assert.match(markupOf('<b>open').problems[0], /never closed/)
})

test('math fences preserve LaTeX, inequalities and adjacent reference markup', () => {
  const parsed=markupOf(String.raw`Value \(a<b>c\), \[\frac{1}{N}\sum_n x_n\] <level-ref to="term"></level-ref>`)
  assert.deepEqual(parsed.problems,[])
  assert.deepEqual(parsed.nodes,['Value ',{math:'a<b>c',display:false},', ',{math:String.raw`\frac{1}{N}\sum_n x_n`,display:true},' ',{ref:'level',to:'term'}])
})

test('code spans retain literal math notation while ordinary emphasis can contain math', () => {
  assert.deepEqual(markupOf(String.raw`<code>\(x\)</code> <b>\(y\)</b>`).nodes,[{tag:'code',kids:[String.raw`\(x\)`]},' ',{tag:'b',kids:[{math:'y',display:false}]}])
})

test('unclosed mathematical text is rejected without hiding surrounding prose', () => {
  for(const fence of [String.raw`\(`,String.raw`\[`]){
    const parsed=markupOf(`before ${fence}x`)
    assert.equal(parsed.problems.length,1)
    assert.match(parsed.problems[0],/unclosed math delimiter/)
    assert.deepEqual(parsed.nodes,[`before ${fence}x`])
  }
})
