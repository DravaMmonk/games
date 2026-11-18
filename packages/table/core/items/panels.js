import { callOf } from 'kernel'
import { L } from 'kernel'
import { tr } from '../lang.js'
import { editTable, editTrace, knapTrace, lcsTable, lcsTrace, localTrace } from '../model/algo.js'
import { TAG, bestTags } from '../model/tags.js'

const passed = (view) => view?.end && view.pass
const line = (s, drawn) => [...s].map((text, k) => ({ text, tone: drawn.has(k) ? 'ins' : null }))
const escaped = (v) => String(v ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch])

const PANELS = {
  lcs(_, t, view) {
    if (!passed(view)) return null
    const { pairs } = lcsTrace(t.top, t.left, lcsTable(t.top, t.left))
    const common = `<b>${escaped(pairs.map((p) => t.top[p[0]]).join(' '))}</b>`
    return {
      title: tr("表格里藏着的连线"),
      caption: tr("从右下角沿绿色格子倒推，每走一次对角线，就是一根连线。公共子序列：{common}", {common}),
      rows: [line(t.top, new Set(pairs.map((p) => p[0]))), line(t.left, new Set(pairs.map((p) => p[1])))],
    }
  },
  edit(_, t, view) {
    if (!passed(view)) return null
    const { ops } = editTrace(t.left, t.top, editTable(t.left, t.top))
    const n = ops.filter((o) => o.k !== 'keep').length
    const tile = (o) => {
      if (o.k === 'keep') return { text: o.a, note: tr("保留") }
      if (o.k === 'rep') return { text: `${o.a}→${o.b}`, note: tr("替换"), tone: 'rep' }
      if (o.k === 'del') return { text: o.a, note: tr("删除"), tone: 'del', strike: true }
      return { text: `+${o.b}`, note: tr("插入"), tone: 'ins' }
    }
    return {
      title: tr("表格倒推出的改法 · {n} 步", {n, value: n === 1 ? '' : 's'}),
      caption: tr("从右下角倒推：走对角线是保留或替换，往上是删除，往左是插入。"),
      rows: [ops.map(tile)],
    }
  },
  spell({ candidates }, t, view, st) {
    if (!passed(view) || st.status.some((x) => x !== 'pass')) return null
    const rows = candidates.map((top) => ({ top, d: editTable(t.left, top)[t.left.length][top.length] })).sort((a, b) => a.d - b.d)
    const best = escaped(rows[0].top)
    return {
      title: tr("候选词 · 按步数排"),
      caption: tr("最近的是 <b>{best}</b>：输入法就会问你「是不是想打 {best}」。", {best}),
      rows: [rows.map(({ top, d }, k) => ({ text: top, tone: k === 0 ? 'ins' : null, note: tr("{d} 步", {d, value: d === 1 ? '' : 's'}) }))],
    }
  },
  local(_, t, view) {
    if (!passed(view)) return null
    const { okTop, okLeft } = localTrace(t)
    return {
      title: tr("最像的一段"),
      caption: tr("从最大的那一格倒推，一直退到 0 为止。"),
      rows: [line(t.top, okTop), line(t.left, okLeft)],
    }
  },
  tags(_, t, view) {
    if (!passed(view)) return null
    const b = bestTags(t)
    return {
      title: tr("表倒推出的标法 · 代价 {cost}", {cost: b.cost}),
      caption: t.note ? escaped(L(t.note)) : null,
      rows: [t.words.map((text, k) => ({ text, tone: 'ins', note: TAG[b.tags[k]].n }))],
    }
  },
  knap(_, t, view) {
    if (!passed(view)) return null
    const chosen = knapTrace(t).picked.map((k) => t.items[k])
    const kg = chosen.reduce((s, it) => s + it.w, 0)
    const value = chosen.reduce((s, it) => s + it.v, 0)
    return {
      title: tr("倒推出的装法"),
      caption: tr("一共 {kg} kg，价值 <b>{value}</b>。", {kg, value}),
      rows: [chosen.map((it) => ({ text: it.n, tone: 'ins', note: `${it.w} kg · ${it.v}` }))],
    }
  },
  roll(_, t, view) {
    const on = view && !view.end && view.k ? view.res.steps[view.k - 1].cell.item : -1
    return {
      title: `${tr("物品")} · ${t.kind === '01' ? tr("每件最多拿一次") : tr("每件可以拿很多次")}`,
      rows: [t.items.map((it, k) => ({ text: it.n, tone: k === on ? 'on' : null, note: `${it.w} kg · ${it.v}` }))],
    }
  },
  dictionary(_, t) {
    const costs = !Array.isArray(t.dict)
    const words = costs ? Object.entries(t.dict) : t.dict.map((w) => [w])
    const row = words.map(([w, c]) => ({ text: c === undefined ? w : `${w} · ${c}` }))
    if (t.letter !== undefined) row.push({ text: tr("单个字母 · {letter}", {letter: t.letter}) })
    return { title: costs ? tr("词典 · 代价") : tr("词典"), rows: [row] }
  },
  robConflict(_, t) {
    const a = t.a
    const cells = (robbed) => a.slice(0, 3).map((value, k) => ({ value, active: k === robbed, next: k === 2, label: tr("{k}号", {k: k + 1}) }))
    return {
      title: tr("反例"),
      lead: tr("看第 1 条街的前两家。下面两段历史走到 2 号时，在一行的机器里落进<b>同一个格子</b>："),
      histories: [{
        name: tr("历史 A"), description: tr("偷了 2 号 · 共 {value}", {value: a[1]}), cells: cells(1),
        result: tr("不能偷 3 号：它和 2 号相邻"), pass: false,
      }, {
        name: tr("历史 B"), description: tr("偷了 1 号 · 共 {value}", {value: a[0]}), cells: cells(0),
        result: tr("可以偷 3 号：{value} + {value2} = {value3}", {value: a[0], value2: a[2], value3: a[0] + a[2]}), pass: true,
      }],
      caption: tr("一个格子只能存一个数。它记住了更大的 {value}（历史 A），就忘掉了历史 B。可走到 3 号时，最好的 {value2} 恰恰来自 B。<b>要让机器分清 A 和 B，格子得多记一件事：这家偷没偷。</b>", {value: a[1], value2: a[0] + a[2]}),
    }
  },
}

export function panelData(call, test, view = null, status = []) {
  const [name, params] = callOf(call)
  return PANELS[name.split('/').at(-1)](params, test, view, { status })
}
