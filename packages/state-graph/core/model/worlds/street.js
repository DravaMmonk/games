// A street of houses: the houses' numbers on top, the table in rows under them.

import { tr } from 'kernel/words'
import { isEn } from 'table'
import { T } from '../../words.js'
import { world, look, cell, num, seg } from 'table';

/* ---------- street of houses: the houses on top, then one row, or three rows once the state remembers "robbed or not" ---------- */

function robPlan(a) {
  const n = a.length, no = [0], rb = [-Infinity];
  for (let i = 1; i <= n; i++) { no[i] = Math.max(no[i - 1], rb[i - 1]); rb[i] = no[i - 1] + a[i - 1]; }
  const plan = [];
  for (let i = n, s = rb[n] > no[n] ? 1 : 0; i >= 1; i--) { if (s) { plan.push(i); s = 0; } else s = rb[i - 1] > no[i - 1] ? 1 : 0; }
  return plan;
}

/**
 * rows: [[outId, label, value before house 1]]; the robot stands on the middle row of its column.
 * The houses' numbers are drawn on the board's top row but are read only as the fact 「这家的钱」 (or its own name), or by
 * a sweeping arm. more = { money: [label, short, icon], noun, top, unit(j), long(j), arm, armSensor, segment, answer, answerKeys, label }.
 * unit(j) is the short tag on the board (「3号」); long(j) names it in English sentences (house 3); noun is what a house holds.
 */
const street = (rows, sensors, more = {}) => {
  const unit = more.unit || (j => tr("{j}号", {j})), long = j => (isEn() ? (more.long || (k => `house ${k}`))(j) : unit(j)), noun = more.noun || T("钱", {}, "street");
  const mid = Math.floor((rows.length - 1) / 2), V = world({
    sensors: { ...sensors, money: num(...(more.money || [T("这家的钱"), T("钱"), 'house'])), ...(more.armSensor ? { seg: seg(...more.armSensor) } : {}) },
    facts: ['money'],
    armSensors: more.armSensor ? ['seg'] : undefined,
    arm: more.arm,
    shown: (L, dr) => dr === -1 - mid,
    outs: rows.map(([id, label], r) => [id, label, [0, r - mid, 0]]),
    here: (t, { i }) => [1 + mid, i],
    keyAt: (t, r, c) => (r === 0 ? (c >= 1 && c <= t.a.length ? `h:${c}` : null) : r <= rows.length && c >= 0 && c <= t.a.length ? `${r - 1}:${c}` : null),
    mark: (t, key) => (key.startsWith('h:') ? { cls: 'house', corner: unit(key.slice(2)) } : {}),
    sense: (t, x, id, get, o) => (id === 'money' ? t.a[x.i - 1] : more.segment(t, x, get, o)),
    base: t => [...rows.map(([, , v], r) => [`${r}:0`, v]), ...t.a.map((x, j) => [`h:${j + 1}`, x])],
    order: t => t.a.map((_, k) => ({ i: k + 1 })),
    keys: (t, { i }) => Object.fromEntries(rows.map(([id], r) => [id, `${r}:${i}`])),
    where: x => `${long(x.i)}`,
    answerKeys: more.answerKeys || (t => [`${rows.length - 1}:${t.a.length}`]),
    answer: more.answer || ((t, table) => table.get(`${rows.length - 1}:${t.a.length}`)),
    name: key => (key.startsWith('h:') ? tr("{value}的{noun}", {noun, value: { zh: String(unit(key.slice(2))), en: String(long(key.slice(2))) }}) : tr("{value2}的「{value}」格", {value: rows[key.split(':')[0]][1], value2: unit(key.split(':')[1]), value3: long(key.split(':')[1])})),
    label: more.label || (t => tr("{length} 户人家", {length: t.a.length})),
    orderText: () => tr("从{value}往后", {value: { zh: String(unit(1)), en: String(long(1)) }}),
    sample: t => ({ i: Math.min(2, t.a.length) }),
    scene(t, view, o = {}) {
      const g = look(view, V.answerKeys(t), V.base(t), o.bench), n = t.a.length, sp = 60, sz = 50, y0 = 92;
      const plan = view && view.end && view.pass && rows.length > 1 ? robPlan(t.a) : [];
      const cells = t.a.map((x, j) => ({ id: `h:${j + 1}`, x: (j + 1) * sp, y: 0, w: sz, h: 58, label: unit(j + 1), value: x, cls: `house${plan.includes(j + 1) ? ' hot' : g.reads.has(`h:${j + 1}`) ? ' pred' : ''}` }));
      const texts = [{ x: -sz / 2 - 10, y: 5, t: more.top || tr("每家的钱"), anchor: 'end' }];
      rows.forEach(([, label], r) => {
        texts.push({ x: -sz / 2 - 10, y: y0 + r * sp + 5, t: label, anchor: 'end', cls: 'hd' });
        for (let i = 0; i <= n; i++) {
          const id = `${r}:${i}`;
          cells.push({ id, x: i * sp, y: y0 + r * sp, w: sz, h: sz, value: g.val(id), corner: r === 0 ? i : '', cls: g.cls(id), tap: g.tap(id), aria: V.name(id) });
        }
      });
      const far = rk => !rk.startsWith('h:') && Math.abs(+rk.split(':')[1] - g.act.cell.i) > 1;
      return { cells, edges: g.arrows(rk => (rk.startsWith('h:') ? `0:${g.act.cell.i}` : `${rk.split(':')[0]}:${g.act.cell.i}`), rk => (far(rk) ? -(18 + 10 * Math.min(6, Math.abs(+rk.split(':')[1] - g.act.cell.i))) : 0)), texts, robot: g.robot };
    },
  });
  return V;
};

const BEST = T("最多偷到"), PREV = T("上一格");
export const rob1 = street([['cell', BEST, 0]], { prev: cell(PREV, T("上格"), [0, 0, -1]) });
export const rob2 = street([['no', T("这家没偷"), 0], ['yes', T("这家偷了"), null], ['best', BEST, 0]], {
  pn: cell(T("上家没偷"), T("没偷", {}, "street"), [0, -1, -1]), pr: cell(T("上家偷了"), T("偷了", {}, "street"), [0, 0, -1]),
});

/** Running totals: cell i is the money of houses 1 … i. The arm sweeps the houses themselves. */
export const prefix = street([['cell', T("到这家一共"), 0]], { prev: cell(PREV, T("左格"), [0, 0, -1]) }, {
  armSensor: [T("这家和前面每家的钱"), T("扫")],
  arm: (t, { i }) => ({ label: tr("扫过前面每一家"), sweeps: [{ sensor: 'seg', label: tr("1 号到这一家"), cells: Array.from({ length: i }, (_, j) => ({ key: `h:${j + 1}`, label: tr("{j}号", {j: j + 1}) })) }] }),
  segment: (t, { i }, get) => Array.from({ length: i }, (_, j) => get(`h:${j + 1}`)),
});

/**
 * Rising runs: posts of different heights in a row; cell i is the longest run of ever-taller posts that ends at post i.
 * Column 0 is a post shorter than all, holding 0, so a run can start anywhere. The arm sweeps every earlier cell.
 */
export const heights = street([['cell', T("最长连几根"), 0]], { prev: cell(PREV, T("左格"), [0, 0, -1]) }, {
  money: [T("这一根的高度"), T("高"), 'post'], noun: T("高度"), top: T("每根的高度"),
  unit: j => tr("{j}号", {j}), long: j => `post ${j}`, label: t => tr("{length} 根柱子", {length: t.a.length}),
  armSensor: [T("前面每一格"), T("扫")],
  arm(t, { i }, o) {
    const cells = Array.from({ length: i }, (_, j) => ({ key: `0:${j}`, label: j ? tr("{j}号", {j}) : undefined, mark: j ? undefined : 'start', out: o.filter === 'lower' && j > 0 && !(t.a[j - 1] < t.a[i - 1]) }));
    return { label: tr("扫过前面每一格"), sweeps: [{ sensor: 'seg', label: tr("起点到上一格"), cells }], filters: [{ v: 'all', l: tr("全部") }, { v: 'lower', l: tr("只留比这根矮的") }] };
  },
  segment: (t, { i }, get, o) => Array.from({ length: i }, (_, j) => j).filter(j => o.filter !== 'lower' || j === 0 || t.a[j - 1] < t.a[i - 1]).map(j => get(`0:${j}`)),
  answerKeys: t => t.a.map((_, j) => `0:${j + 1}`),
  answer: (t, table) => Math.max(...t.a.map((_, j) => table.get(`0:${j + 1}`) ?? -Infinity)),
});

/**
 * Daily gains: a day's gain or loss in each column; cell i holds the best total of a run of days that ends on day i.
 * The answer is the largest cell. The arm sweeps every day so far (the tempting, wrong way: a run need not start on
 * day 1).
 */
export const gains = street([['cell', T("以这天结尾最多"), 0]], { prev: cell(PREV, T("左格"), [0, 0, -1]) }, {
  money: [T("这天的收支"), T("收支"), 'gain'], noun: T("收支"), top: T("每天的收支"),
  unit: j => tr("第{j}天", {j}), long: j => `day ${j}`, label: t => tr("{length} 天", {length: t.a.length}),
  armSensor: [T("这天和前面每天的收支"), T("扫")],
  arm: (t, { i }) => ({ label: tr("扫过前面每一天"), sweeps: [{ sensor: 'seg', label: tr("第 1 天到这一天"), cells: Array.from({ length: i }, (_, j) => ({ key: `h:${j + 1}`, label: String(j + 1) })) }] }),
  segment: (t, { i }, get) => Array.from({ length: i }, (_, j) => get(`h:${j + 1}`)),
  answerKeys: t => t.a.map((_, j) => `0:${j + 1}`),
  answer: (t, table) => Math.max(...t.a.map((_, j) => table.get(`0:${j + 1}`) ?? -Infinity)),
});

