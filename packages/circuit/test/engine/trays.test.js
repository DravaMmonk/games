import { circuitFixtureSchema } from '../../../qed/test/fixture.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trayDisplay } from '../../core/trays.js'
import { trayMembers } from '../../core/index.js'

test('tray menus show only available parts; every folded part in a menu goes into it', () => {
  const menu = { id: 'or', title: '∨', items: ['orI', 'orE', 'locked'] }
  const trays = { proof: { name: 'Proof', desc: 'Proof tools', items: [menu, 'swap'] } }
  const part = (type) => ({ type })
  assert.deepEqual(trayMembers(trays.proof), ['orI', 'orE', 'locked', 'swap'])
  // Few shown: nothing gathers; the folded part of the menu forms the menu among the folded, the other stands alone.
  const few = trayDisplay(trays, ['proof'], [part('orI')], [part('orE'), part('swap')])
  assert.deepEqual(few.items, [part('orI')])
  assert.deepEqual(few.folded.map((item) => item.children ?? item), [[part('orE')], part('swap')])
})

const part = (type) => ({ type })
const flat = ({ items, folded }) => ({ items: items.map((item) => item.children ? { menu: item.label, of: item.children.map(({ type }) => type) } : item.type), folded: folded.map((item) => item.children ? { menu: item.label, of: item.children.map(({ type }) => type) } : item.type) })

test('variants inherit the original menu while shown cards remain visible below the threshold', () => {
  const trays = {
    machine: { items: [{ id: 'machine-rules', title: 'Reasoning', items: ['assumption'] }] },
    proof: { items: [
      { id: 'implication', title: 'Implication', items: ['impI-stage', 'assumption'] },
      { id: 'laws', title: 'Laws', items: ['dneg'] },
    ] },
  }
  const shown = [{ type: 'backImpI', traySource: 'impI' }]
  const folded = [
    part('assumption'),
    { type: 'backAssumption', traySource: 'assumption' },
    { type: 'backDneg', traySource: 'dneg' },
    { type: 'rewriteDneg', traySource: 'dneg' },
    { type: 'backUnlisted', traySource: 'unlisted' },
  ]
  const partOf = type => type === 'impI-stage' ? 'impI' : type
  assert.deepEqual(flat(trayDisplay(trays, ['machine'], shown, folded, partOf)), {
    items: ['backImpI'],
    folded: [{ menu: 'Reasoning', of: ['assumption', 'backAssumption'] }, { menu: 'Laws', of: ['backDneg', 'rewriteDneg'] }, 'backUnlisted'],
  })
  assert.deepEqual(trayDisplay({}, [], shown, folded), { items: shown, folded })
  const grouped = { ...trays, machine: { ...trays.machine, menuThreshold: 2 } }
  const both = [...shown, { type: 'backImpI2', traySource: 'impI' }]
  assert.deepEqual(flat(trayDisplay(grouped, ['machine'], both, folded, partOf)).items,
    [{ menu: 'Implication', of: ['backImpI', 'backImpI2'] }])
})

test('below the threshold (7 by default) the shown parts stand on their own', () => {
  const trays = { t: { items: [{ id: 'm', title: 'M', items: ['a', 'b', 'c'] }, 'x', 'y', 'z'] } }
  assert.deepEqual(flat(trayDisplay(trays, ['t'], ['a', 'b', 'c', 'x', 'y', 'z'].map(part), [])).items, ['a', 'b', 'c', 'x', 'y', 'z'])
})

test('at the threshold the fullest menu gathers first, then the next, until the tray holds fewer entries', () => {
  const trays = { t: { items: [
    { id: 'small', title: 'S', items: ['s1', 's2'] },
    { id: 'big', title: 'B', items: ['b1', 'b2', 'b3'] },
    'x', 'y', 'z',
  ] } }
  // 8 shown: B (3) gathers first, leaving 6 entries, fewer than 7: S stays open.
  const shown = ['s1', 's2', 'b1', 'b2', 'b3', 'x', 'y', 'z'].map(part)
  assert.deepEqual(flat(trayDisplay(trays, ['t'], shown, [])).items, ['s1', 's2', { menu: 'B', of: ['b1', 'b2', 'b3'] }, 'x', 'y', 'z'])
  // With the threshold at 5, S gathers too (6 → 5 entries is still not fewer, so it goes on and then stops: no menu left).
  const five = { t: { ...trays.t, menuThreshold: 5 } }
  assert.deepEqual(flat(trayDisplay(five, ['t'], shown, [])).items, [{ menu: 'S', of: ['s1', 's2'] }, { menu: 'B', of: ['b1', 'b2', 'b3'] }, 'x', 'y', 'z'])
})

test('a gathered menu holds its folded parts; a menu with one shown part never gathers it', () => {
  const trays = { t: { menuThreshold: 3, items: [{ id: 'm', title: 'M', items: ['a', 'b', 'c'] }, { id: 'one', title: 'O', items: ['o', 'p'] }, 'x'] } }
  const display = trayDisplay(trays, ['t'], ['a', 'b', 'o', 'x'].map(part), ['c', 'p'].map(part))
  // M gathers (4 → 3 entries, still at the threshold), O cannot (only o is shown): stop.
  assert.deepEqual(flat(display), { items: [{ menu: 'M', of: ['a', 'b', 'c'] }, 'o', 'x'], folded: [{ menu: 'O', of: ['p'] }] })
})

test('gathering stops once the menus alone reach the threshold', () => {
  const trays = { t: { menuThreshold: 2, items: [{ id: 'm', title: 'M', items: ['a', 'b'] }, { id: 'n', title: 'N', items: ['c', 'd'] }, { id: 'k', title: 'K', items: ['e', 'f'] }] } }
  const display = trayDisplay(trays, ['t'], ['a', 'b', 'c', 'd', 'e', 'f'].map(part), [])
  assert.deepEqual(flat(display).items, [{ menu: 'M', of: ['a', 'b'] }, { menu: 'N', of: ['c', 'd'] }, 'e', 'f'])
})

test('switching trays groups only the parts in the selected tray', () => {
  const items = [{ type: 'orI' }, { type: 'orE' }]
  const trays = {
    proof: { name: 'Proof', desc: 'Proof tools', items: [{ id: 'or', title: '∨', items: ['orI', 'orE'] }] },
    rules: { name: 'Rules', desc: 'Rules', items: ['orI', 'orE'] },
  }
  assert.deepEqual(trayDisplay({ ...trays, proof: { ...trays.proof, menuThreshold: 2 } }, ['proof'], items, []).items[0].children, items)
  assert.deepEqual(trayDisplay(trays, ['rules'], items, []).items, items)
})

test('tray overrides use generic collection patches and nested identified lists', async () => {
  const { applyOverride: override } = await import('../../../../games/kit/engine/layers.js')
  const apply = (before, patch) => override('circuit/tray', before, patch, circuitFixtureSchema({}))
  const source = { title: 'Tools', values: ['a'], menus: [{ id: 'group', title: 'Group', values: ['b'] }] }
  const next = apply(source, { values: { add: ['c'] }, menus: { add: [{ id: 'group', values: { add: ['d'] } }, { id: 'other', title: 'Other', values: ['e'] }] } })
  assert.deepEqual(next.values, ['a', 'c'])
  assert.deepEqual(next.menus[0], { id: 'group', title: 'Group', values: ['b', 'd'] })
  assert.deepEqual(apply(next, { menus: { remove: ['group'] } }).menus.map(menu => menu.id), ['other'])
  assert.deepEqual(apply(source, { values: ['z'], menus: [] }), { title: 'Tools', values: ['z'], menus: [] })
})
