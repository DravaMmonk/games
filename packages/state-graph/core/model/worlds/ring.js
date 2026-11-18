// A ring of houses on 千层: the first and the last house are neighbours. Two layers, 甲 and 乙, each the robber's
// street (a row for "this house skipped" and one for "robbed"); what tells the layers apart is up to the player, with
// the facts "is the first house", "is the last house" and "is layer 甲". The answer is the best of both layers' last
// column. t = { a: [money in house 1 …] }.

import { tr } from 'kernel/words'
import { T } from '../../words.js'
import { world, look, cell, num, yes } from 'table';

const SIDES = [T("甲"), T("乙")];
const ROWS = [T("没偷"), T("偷了")];
const n = t => t.a.length;

export const ring = world({
  sensors: {
    pn: cell(T("上一家·没偷"), T("没偷", {}, "ring"), [0, 0, -1]), pr: cell(T("上一家·偷了"), T("偷了", {}, "ring"), [0, 1, -1]),
    money: num(T("这家的钱"), T("钱"), 'house'),
    first: yes(T("是第一家"), T("首"), 'firsthouse'), last: yes(T("是最后一家"), T("尾"), 'lasthouse'),
    sideA: yes(T("是甲层"), T("甲"), 'layers'),
  },
  facts: ['money', 'first', 'last', 'sideA'],
  // The robot stands on its layer's "skipped" row and writes both rows of its column.
  outs: [['no', ROWS[0], [0, 0, 0]], ['yes', ROWS[1], [0, 1, 0]]],
  here: (t, { i }) => [0, i],
  keyAt: (t, r, c, x) => (r >= 0 && r <= 1 && c >= 0 && c <= n(t) ? `${x ? x.m : 0}|${r}:${c}` : null),
  winLabel: (t, x) => tr("{value}层", {value: SIDES[x.m]}),
  mark: (t, key) => ({ corner: key.split(':')[1] }),
  sense(t, { i, m }, id) {
    switch (id) {
      case 'money': return t.a[i - 1];
      case 'first': return i === 1;
      case 'last': return i === n(t);
      case 'sideA': return m === 0;
    }
    return null;
  },
  base: () => [0, 1].flatMap(m => [[`${m}|0:0`, 0], [`${m}|1:0`, null]]),
  order(t) {
    const cells = [];
    for (let i = 1; i <= n(t); i++) [0, 1].forEach(m => cells.push({ i, m, id: `${m}|${i}` }));
    return cells;
  },
  keys: (t, x) => ({ no: `${x.m}|0:${x.i}`, yes: `${x.m}|1:${x.i}` }),
  where: x => tr("{value}层 · {i}号", {value: SIDES[x.m], i: x.i}),
  answerKeys: t => [0, 1].flatMap(m => [`${m}|0:${n(t)}`, `${m}|1:${n(t)}`]),
  answer(t, table) { return Math.max(...this.answerKeys(t).map(k => table.get(k) ?? -Infinity)); },
  name: key => { const [m, rc] = key.split('|'), [r, c] = rc.split(':'); return tr("{value}层 {c}号「{value2}」", {value: SIDES[m], c, value2: ROWS[r]}); },
  label: t => tr("{value} 户人家围成一圈", {value: n(t)}),
  orderText: () => tr("一家一家往后，每家算遍两层"),
  sample: t => ({ i: Math.min(2, n(t)), m: 0, id: `0|${Math.min(2, n(t))}` }),
  scene(t, view, o = {}) {
    const g = look(view, this.answerKeys(t), this.base(t), o.bench), sp = 58, sz = 50, y0 = 70, cells = [];
    const texts = [{ x: -sz / 2 - 10, y: 5, t: tr("每家的钱"), anchor: 'end' }];
    t.a.forEach((x, k) => cells.push({ id: `h:${k + 1}`, x: (k + 1) * sp, y: 0, w: sz, h: 40, value: x, cls: 'house' }));
    [0, 1].forEach(m => ROWS.forEach((row, r) => {
      const y = y0 + (m * 2 + r) * sp + (m ? 16 : 0);
      texts.push({ x: -sz / 2 - 10, y: y + 5, t: tr("{value}·{row}", {value: SIDES[m], row}), anchor: 'end', cls: 'hd' });
      for (let c = 0; c <= n(t); c++) {
        const id = `${m}|${r}:${c}`;
        cells.push({ id, x: c * sp, y, w: sz, h: sz, value: g.val(id), corner: m === 0 && r === 0 ? c : '', cls: g.cls(id), tap: g.tap(id), aria: this.name(id) });
      }
    }));
    return { cells, edges: g.arrows(), texts, robot: g.robot };
  },
});
