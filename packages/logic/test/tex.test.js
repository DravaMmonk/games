// The machine board's lines as TeX (../core/tex.js): logic's signs as TeX's, subscripts, letters in math, words upright.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { texOf } from '../core/tex.js'

test('a goal reads as TeX: words upright, signs as commands, a numbered turnstile', () => {
  assert.equal(texOf('下雨 → 地湿；下雨 ⊢₁ 地湿'), '\\text{下雨}\\to \\text{地湿}\\text{；}\\text{下雨}\\vdash _{1}\\text{地湿}')
  assert.equal(texOf('⊢ it rains → (it is windy → it rains)'), '\\vdash \\text{it rains}\\to (\\text{it is windy}\\to \\text{it rains})')
})

test('a rule keeps its letters in math, its mark apart from its brackets', () => {
  assert.equal(texOf('R₁ ⟦?A⟧ ⟹ ?B'), 'R_{1}\\; \\llbracket ?A\\rrbracket \\Longrightarrow ?B')
  assert.equal(texOf('⋀x. P(x)'), '\\bigwedge x.\\, P(x)')
})

test("a step's marks: a rule backwards, a goal closed", () => {
  assert.equal(texOf('⊢ ⟵ R₁ R₃'), '\\vdash \\longleftarrow R_{1}\\; R_{3}')
  assert.equal(texOf('⊢ ✓'), '\\vdash \\checkmark')
  assert.equal(texOf('⊢ ⤓'), '\\vdash \\underline{\\downarrow}')
  assert.equal(texOf('↻'), '\\circlearrowright')
  assert.equal(texOf('↪'), '\\hookrightarrow')
  assert.equal(texOf('¬¬?A ⟼ ?A'), '\\lnot \\lnot ?A\\longmapsto ?A')
})

test("TeX's own characters inside words are escaped", () => {
  const tex = texOf('50% & more_than')
  for (const escaped of ['\\%', '\\&', '\\_']) assert.ok(tex.includes(escaped), tex)
})
