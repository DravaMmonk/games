// Value maps: a treasure, traps and cliffs whose values are fixed, walls nobody can enter, and floor cells whose value
// is how good it is to stand there. Levels on these maps scan in rounds until the table stops changing.

import { sceneEdge, slipAt, tileAt, policy, valueBase, valueOrder } from 'table';
import { tr } from 'kernel/words'
import { T } from '../../words.js'
import { rcName } from 'table';
import { world, look, num } from 'table';
import { gridDef } from './grid.js';

const LABEL = { gold: T("宝藏"), trap: T("陷阱"), cliff: T("悬崖"), wall: '' };
/** The icon a special tile carries in its corner (svg.js MARKS); its name stays for screen readers. */
const MARK_OF = { gold: 'gold', trap: 'trap', cliff: 'cliff' };

export const vgrid = world({
  ...gridDef,
  sensors: {
    ul: gridDef.sensors.ul, up: gridDef.sensors.up, ur: gridDef.sensors.ur, left: gridDef.sensors.left, right: gridDef.sensors.right, dl: gridDef.sensors.dl, down: gridDef.sensors.down, dr: gridDef.sensors.dr,
    slip: num(T("打滑的可能"), T("滑"), 'ice'), grip: num(T("站稳的可能", {}, "value"), T("稳"), 'hold'),
  },
  facts: [],
  // The floor under the robot: how likely it is to slip, and (so no subtracting is needed) how likely to hold.
  sense: (t, { r, c }, id) => (id === 'slip' ? slipAt(t, r, c) : id === 'grip' ? Math.round((1 - slipAt(t, r, c)) * 1e9) / 1e9 : null),
  mark(t, key) {
    const [r, c] = key.split(',').map(Number), k = tileAt(t, r, c);
    // An icy cell shows its chance to slip in the corner.
    const ice = k === 'floor' && (t.ice || []).some(p => p[0] === r && p[1] === c);
    return { cls: k === 'floor' ? (ice ? 'ice' : '') : k === 'wall' ? 'rock' : k, label: LABEL[k] || '', mark: MARK_OF[k] || (r + c === 0 ? 'start' : null), corner: ice ? String(slipAt(t, r, c)) : '' };
  },
  /** Fixed tiles hold their value from the start; every floor cell starts at 0. */
  base: valueBase,
  order: valueOrder,
  answerKey: () => '0,0',
  label: t => `${t.R}×${t.C}${t.slip ? tr(" · 会打滑") : t.ice ? tr(" · 有冰") : ''}`,
  orderText: () => tr("逐行，从左上开始，一轮一轮地扫"),
  sample: t => ({ r: 0, c: 0, id: '0,0' }),
  scene(t, view, o) {
    const g = look(view, [this.answerKey(t, o)], this.base(t, o), o.bench), cells = [];
    for (let r = 0; r < t.R; r++) for (let c = 0; c < t.C; c++) {
      const id = `${r},${c}`, m = this.mark(t, id), fixed = tileAt(t, r, c) !== 'floor';
      cells.push({ id, x: c * 64, y: r * 64, w: 56, h: 56, value: tileAt(t, r, c) === 'wall' ? '' : g.val(id), mark: m.mark, corner: m.corner, cls: `${m.cls} ${fixed ? '' : g.cls(id)}`, tap: !fixed && g.tap(id), aria: m.label ? `${rcName(id)} · ${m.label}` : rcName(id) });
    }
    const edges = g.arrows();
    // Once the values have settled, every floor cell grows an arrow toward its best move.
    // (On a right-or-down map, t.rd, a slippery one or an icy one, the arrows point right or down.)
    if (o.arrows && view && view.end && view.pass) policy(t, g.shown, { slip: t.rd || t.slip || t.ice ? (r, c) => slipAt(t, r, c) : null }).forEach(([a, b]) => edges.push(sceneEdge(a, b, 'good')));
    return { cells, edges, robot: g.robot };
  },
});
