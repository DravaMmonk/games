import { TAGS, TAG } from 'table'
// Tagging a sentence: rows are parts of speech, columns are the words; one cell before the first word is the start.
// A cell holds the cheapest explanation of the words so far that gives this word this tag (costs), or, with o.prob,
// how likely the words so far are with this word in this tag (probabilities, summed over every way to get here).

import { sceneEdge } from 'table';
import { tr } from 'kernel/words'
import { lazy } from 'table'
import { T } from '../../words.js'
import { world, look, cell, num, THIS_CELL } from 'table';

/** 「a noun」, 「an adjective」. */
export const aTag = g => `${/^[aeiou]/.test(String(TAG[g].n)) ? 'an' : 'a'} ${TAG[g].n}`;

/**
 * t = { words, emit: [{ N?, V?, A? } per word] (a missing tag is impossible), trans: { from: { to } }, start: { tag } }.
 * The robot reaches back to the three cells of the previous word with its arm.
 */
export const tags = world({
  sensors: {
    ...Object.fromEntries(TAGS.map(g => [`p${g}`, cell(lazy(() => tr("前词是{n}", {n: { zh: String(TAG[g].n), en: String(aTag(g)) }})), lazy(() => tr("前{s}", {s: TAG[g].s})))])),
    ...Object.fromEntries(TAGS.map(g => [`t${g}`, num(lazy(() => tr("跟在{n}后", {n: { zh: String(TAG[g].n), en: String(aTag(g)) }})), lazy(() => tr("跟{s}", {s: TAG[g].s})), `after${g}`)])),
    emit: num(T("这个词这么标"), T("标"), 'tag'),
  },
  facts: ['tN', 'tV', 'tA', 'emit'],
  armSensors: TAGS.map(g => `p${g}`),
  outs: [['cell', THIS_CELL, [0, 0, 0]]],
  here: (t, { r, c }) => [r, c],
  keyAt: (t, r, c) => (r >= 0 && r < TAGS.length && c >= 0 && c <= t.words.length && (c || !r) ? `${r},${c}` : null),
  mark: () => ({}),
  sense(t, { r, c }, id, get) {
    const tag = TAGS[r];
    if (id === 'emit') return t.emit[c - 1][tag] ?? null;
    // The first word comes straight from the start: only the first slot reaches back, with the start's cost.
    if (id[0] === 't') return c > 1 ? t.trans[id[1]][tag] : id[1] === TAGS[0] ? t.start[tag] : null;
    return c > 1 || id[1] === TAGS[0] ? get(`${c > 1 ? TAGS.indexOf(id[1]) : 0},${c - 1}`) : null;
  },
  arm: (t, { c }) => ({ label: c === 1 ? tr("前面是句首") : tr("「{value}」的三种词性", {value: t.words[c - 2]}), cells: TAGS.map((g, k) => ({ tap: `p${g}`, key: c > 1 ? `${k},${c - 1}` : k ? null : '0,0', label: c > 1 ? TAG[g].s : k ? '' : tr("首", {}, "tags") })) }),
  base: (t, o) => [['0,0', o.prob ? 1 : 0]],
  order: t => { const o = []; for (let c = 1; c <= t.words.length; c++) TAGS.forEach((_, r) => o.push({ r, c, id: `${r},${c}` })); return o; },
  keys: (t, x) => ({ cell: x.id }),
  where: x => tr("第 {c} 个词当{n}", {c: x.c, n: { zh: String(TAG[TAGS[x.r]].n), en: String(aTag(TAGS[x.r])) }}),
  answerKeys: t => TAGS.map((_, k) => `${k},${t.words.length}`),
  answer(t, table, o) {
    const v = this.answerKeys(t).map(k => table.get(k)).filter(x => x !== null && x !== undefined);
    return !v.length ? null : o.prob ? Math.round(v.reduce((a, b) => a + b, 0) * 1e9) / 1e9 : Math.min(...v);
  },
  name: key => { const [r, c] = key.split(',').map(Number); return c ? tr("第 {c} 个词的「{n}」格", {c, n: TAG[TAGS[r]].n}) : tr("句首"); },
  label: t => t.words.join(' '),
  orderText: () => tr("逐列，从第一个词开始"),
  sample: t => ({ r: 1, c: Math.min(2, t.words.length), id: `1,${Math.min(2, t.words.length)}` }),
  scene(t, view, o = {}) {
    const g = look(view, [], this.base(t, o), o.bench), sp = 64, sz = 56, cells = [], texts = [], n = t.words.length;
    [tr("句首", {}, "tags"), ...t.words].forEach((w, c) => cells.push({ id: `w${c}`, x: c * sp, y: -sp + 14, w: sz, h: 30, value: w, cls: `axis${c ? '' : ' axis0'}${String(w).length > 3 ? ' word' : ''}` }));
    const colMax = c => Math.max(...TAGS.map((_, r) => g.shown.get(`${r},${c}`) ?? 0)), path = o.path || [];
    TAGS.forEach((tag, r) => {
      texts.push({ x: -sz / 2 - 10, y: r * sp + 5, t: TAG[tag].n, anchor: 'end', cls: 'hd' });
      for (let c = r ? 1 : 0; c <= n; c++) {
        const id = `${r},${c}`, v = g.shown.get(id), em = c ? t.emit[c - 1][tag] : undefined;
        cells.push({
          id, x: c * sp, y: r * sp, w: sz, h: sz, value: g.val(id), corner: c ? (em === undefined ? '×' : em) : '', cls: [c ? '' : 'lit', g.cls(id), c && em === undefined ? 'dimc' : '', path.includes(id) ? 'path' : ''].filter(Boolean).join(' '),
          tap: c > 0 && g.tap(id), aria: this.name(id), ...(o.prob && c && typeof v === 'number' && colMax(c) > 0 ? { bar: v / colMax(c) } : {}),
        });
      }
    });
    const edges = g.arrows();
    for (let q = 0; q + 1 < path.length; q++) edges.push(sceneEdge(path[q], path[q + 1], 'good'));
    return { cells, edges, texts, robot: g.robot };
  },
});

const TAG_START = T("句首", {}, "tags");
/** Every way to tag a sentence, with its total cost: the cheapest one is what the table finds. */
