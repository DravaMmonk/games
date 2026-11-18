import { defineParts } from 'circuit'
import { qualifyItems } from 'kernel';
// The parts of a table board (games/design/README.md 3): the primitives every course starts from, the input cards the level
// gives, and the parts the player builds (registered by course.js, each running the board it was built from).
//
// Signals are numbers, null (「—」: no route), booleans (「是 / 否」), kinds ({ cat, label }) or whole segments: lists of
// numbers or booleans that a sweeping arm reads. A part declares what each input port takes and what its output
// carries:
//   port types   'kernel/number' | 'kernel/boolean' | 'table/category' | 'kernel/any' (a number, a yes / no or a kind) — a trailing '*' also takes a segment
//   signal types 'kernel/number' | 'kernel/boolean' | 'table/category' | 'table/numbers' | 'table/booleans' | 'kernel/any' (not known until something is wired in)
//   out          a signal type, { copy: k } (whatever reaches input k), 'lift' (a segment if any input is one) or
//                'input' (a card's outputs carry what each of its sensors carries)
// Its ports are '0', '1', …; an unconnected one reads null (a number port) or false (a condition port).
// A part with `params` carries those settings on its node (node.params); a constant its number, `value`.

import { OPS, tidy } from './format.js';
import { T } from '../lang.js';

const merge = op => ins => { const v = ins.flat().filter(x => x !== null); return v.length ? op(v) : null; };
/** a ∘ b, element by element when either side is a segment (a single number then applies to every element). */
const zip = op => ([a, b]) => {
  const one = (x, y) => (x === null || y === null || x === undefined || y === undefined ? null : tidy(op(x, y)));
  if (!Array.isArray(a) && !Array.isArray(b)) return one(a, b);
  const n = Math.max(Array.isArray(a) ? a.length : 0, Array.isArray(b) ? b.length : 0);
  return Array.from({ length: n }, (_, k) => one(Array.isArray(a) ? a[k] : a, Array.isArray(b) ? b[k] : b));
};
const SKIP = ['「—」不参与；全是「—」时，输出「—」。', '“—” is left out; if every input is “—”, the output is “—”.'];
const MERGER = T("汇合器");
const CONSTANT_VALUES = [0, 1, 2, 3, 4, 5];

/** The primitives: what a course may start from (the circuit/primitives tag) and a level bring in (adds). */
export const PRIMITIVES = qualifyItems('table', {
  msum: { name: MERGER, tag: T("加起来"), ins: ['table/number-input', 'table/number-input', 'table/number-input'], out: 'kernel/number', f: merge(OPS.sum), desc: T("把接进来的数加起来。{value}", {value: { zh: String(SKIP[0]), en: String(SKIP[1]) }}) },
  mmin: { name: MERGER, tag: T("取较小"), ins: ['table/number-input', 'table/number-input', 'table/number-input'], out: 'kernel/number', f: merge(OPS.min), desc: T("留下接进来的数里最小的那个。{value}", {value: { zh: String(SKIP[0]), en: String(SKIP[1]) }}) },
  mmax: { name: MERGER, tag: T("取较大"), ins: ['table/number-input', 'table/number-input', 'table/number-input'], out: 'kernel/number', f: merge(OPS.max), desc: T("留下接进来的数里最大的那个。{value}", {value: { zh: String(SKIP[0]), en: String(SKIP[1]) }}) },
  many: { name: MERGER, tag: T("任一是"), ins: ['table/boolean-input', 'table/boolean-input', 'table/boolean-input'], out: 'kernel/boolean', f: ins => ins.flat().some(v => v === true), desc: T("接进来的「是 / 否」里只要有一个「是」，就输出「是」；否则输出「否」。「—」不算「是」。") },
  not: { name: T("取反"), tag: T("是 ↔ 否"), ins: ['kernel/boolean'], out: 'kernel/boolean', f: ([v]) => (v === null ? null : !v), desc: T("「是」变「否」，「否」变「是」。收到「—」时，输出「—」。") },
  add: { name: T("加法器"), tag: 'a + b', ins: ['table/number-input', 'table/number-input'], labels: ['a', 'b'], out: 'lift', f: zip((a, b) => a + b), desc: T("输出 a + b。只要有一边是「—」，结果就是「—」。") },
  mul: { name: T("乘法器"), tag: 'a × b', ins: ['table/number-input', 'table/number-input'], labels: ['a', 'b'], out: 'lift', f: zip((a, b) => a * b), desc: T("输出 a × b。只要有一边是「—」，结果就是「—」。") },
  const: { name: T("常数"), ins: [], out: 'kernel/number', params: ['value'], f: (_, n) => n.params?.value ?? 1, desc: T("一直输出同一个数。放上电路板后，点它可以改数值。") },
  pass: { name: T("放行闸"), tag: T("是 → 放行"), ins: ['kernel/boolean', 'kernel/any'], labels: [T("条件"), T("数")], out: { copy: 1 }, f: ([c, v]) => (c ? v : null), desc: T("条件是「是」时，把另一个口收到的信号放过去；否则输出「—」。") },
  block: { name: T("拦截闸"), tag: T("是 → 拦下"), ins: ['kernel/boolean', 'kernel/any'], labels: [T("条件"), T("数")], out: { copy: 1 }, f: ([c, v]) => (c ? null : v), desc: T("条件是「是」时，输出「—」；否则把另一个口收到的信号原样放过去。") },
}, { bare: true });

/** Models that swap for one another on the card, keeping their wires: the mergers that merge numbers. */
export const MODELS = [['table/msum', 'table/mmin', 'table/mmax']];
export const modelsOf = type => MODELS.find(m => m.includes(type)) || null;

/**
 * The parts a level gives every board (never placed or removed), each a source of its own:
 *   视野 ('view')         the cells the robot sees and what its arm reaches: an output for each sensor it picks
 *   本格信息 ('facts')     facts about the robot's own cell: an output for each it picks
 *   a port input ('port')  on the board that builds a part, an input of that part with no sensor in the level's world
 *                          (the third way into the Cheapest Cell): 「—」 in the level, the part's port once packed
 *   a sensor ('tap')       one sensor wired straight in, on a part's bench in the components box
 * A card's picks are its node's params.picks, in the order the card offers them.
 */
export const CARDS = {
  view: { name: T("视野"), tag: T("视野", {}, "parts"), desc: T("机器人看得见的格子。点一格，就多一个读那一格的输出口；再点一次，输出口就去掉。") },
  facts: { name: T("本格信息"), tag: T("本格"), desc: T("机器人脚下这一格的信息。每选一条，就多一个读它的输出口。") },
};
export const isCard = type => type === 'view' || type === 'facts';
/** A source the level gives (a card, a port input, a sensor wired straight in): never placed by the player. */
export const isGiven = type => isCard(type) || type === 'port' || type === 'tap' || type === 'out';

/**
 * A course's parts: the primitives, and `built`, the parts its player builds, by part key ('counter'), registered by
 * course.js from the levels that build them: { name, desc, ins: [port type], labels: [short], sensors: [sensor | null],
 * inputs: [port input id | null], out, outType, setting?: default number, board(), part } — board() the board it runs
 * (the player's, or its level's reference board), `part` the engine part that runs it. Each course holds its own, so
 * two courses read in one process never see each other's boards.
 *   def(type)          what a part is (null: no such part)
 *   hasValue(type)     whether it carries a number set on its card: a constant, or a built part with a setting
 *   valueDefault(type) the number it starts with when it is placed
 *   valueOptions(type, task) the ordered choices for that number on this task, or null when the part has no setting
 */
export function partsOf(built, definitions) {
  const { PARTS: compiled, defs } = defineParts(definitions, {});
  const declared = Object.fromEntries(Object.entries(compiled).map(([type, part]) => [type, {
    name: defs[type].name, desc: defs[type].desc, tag: T("零件"),
    ins: part.inputs.map(name => part.inputTypes?.[name] ?? 'kernel/any'),
    labels: part.inputs, out: part.outputType, params: part.params,
    f: (values, node) => part.eval(Object.fromEntries(part.inputs.map((name, index) => [name, values[index]])), node, {}),
  }]));
  const def = type => {
    if (Object.hasOwn(declared, type)) return declared[type];
    if (Object.hasOwn(PRIMITIVES, type)) return PRIMITIVES[type];
    const b = Object.hasOwn(built, type) ? built[type] : null;
    return b ? { name: b.name, tag: T("零件"), ins: b.ins, labels: b.labels, desc: b.desc, built: true, out: b.outType, params: b.setting !== undefined ? ['value'] : [] } : null;
  };
  const hasValue = type => type === 'table/const' || built[type]?.setting !== undefined;
  const valueDefault = type => (type === 'table/const' ? 1 : built[type]?.setting);
  const valueOptions = (type, task) => hasValue(type) ? (task.consts ?? CONSTANT_VALUES) : null;
  return { built, types: [...Object.keys(PRIMITIVES), ...Object.keys(declared)], def, hasValue, valueDefault, valueOptions };
}
