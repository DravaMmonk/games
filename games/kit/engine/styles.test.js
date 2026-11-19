// node --test (npm test) — no part of the kit writes out more font sizes, colours, spacing or corner radii than it did
// when the tokens became the rule (styles.js). Shared areas keep their ceilings as styles move onto tokens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { measure, rawStyles } from './styles.js'

const CEILING = {
  kit: { sizes: 15, colours: 19 },
  shell: { sizes: 208, colours: 20 },
  views: { sizes: 1, colours: 2 },
}

test('sizes, spacing and radii written in pixels count in a style sheet; a colour written out counts in a style sheet or a string in code', t => {
  const dir = mkdtempSync(join(tmpdir(), 'styles-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'ui'))
  writeFileSync(join(dir, 'ui', 'a.css'), '.a { font-size: 12px; color: #3f7fb5; padding: var(--sp-4) 10px; border-radius: 6px; }\n.b { font: 600 var(--fs-ui) var(--mono); background: rgba(0, 0, 0, .1); gap: var(--gap-group); margin-top: -1px; }\n.c { font: 11px var(--mono); --tool-h: 32px; border-radius: var(--r-md); margin: calc(var(--sp-5) * -1) 0; }')
  writeFileSync(join(dir, 'ui', 'A.jsx'), "const fill = '#e0e8e5' // #abc in a comment\nconst id = `${a}#${b}`")
  assert.deepEqual(rawStyles(dir), { sizes: 2, colours: 3, spacing: 1, radii: 1 })
})

test('no area writes out more sizes, colours, spacing or radii than its ceiling', () => {
  const counts = measure(resolve(import.meta.dirname, '..'))
  assert.deepEqual(Object.keys(counts), Object.keys(CEILING))
  const over = Object.entries(counts).flatMap(([area, got]) => Object.entries(got).flatMap(([kind, count]) => {
    const ceiling = CEILING[area][kind] ?? 0
    return count > ceiling ? [`${area}: ${count} ${kind} (at most ${ceiling})`] : []
  }))
  assert.deepEqual(over, [])
})
