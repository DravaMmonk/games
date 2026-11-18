// Fill each cell by hand with the number pad: the routes to a place are the sum of the routes to every place that
// points to it.
import { useMemo, useState } from 'react'
import { evalGraph } from '../../../core/model/algo.js'
import { E } from '../../../core/model/scene.js'
import { W } from '../../../core/model/robot-scene.js'
import { tr, lazy } from '../../../core/lang.js'
import { boardDrawing } from '../scene.js'
import { buzz, typing, useVerdict } from 'kernel/view'
import { useWorkspaceKeys } from 'kernel/view'
import { L as text } from 'kernel/view'
import { WORDS } from 'kernel/view'

export default function useFill({ level, saved, save, solve, fail, toast }) {
  const L = level.source
  const [vals, setVals] = useState(() => saved?.vals ?? {})
  const [sel, setSel] = useState(null)
  const [input, setInput] = useState('')
  const [marks, setMarks] = useState({})
  const verdict = useVerdict({ hints: L.hints, solve, fail })
  const { by, truth } = useMemo(() => ({
    by: Object.fromEntries(L.cells.map((c) => [c.id, c])),
    truth: evalGraph(L.cells.map((c) => (c.id === L.start ? { ...c, fixed: 1 } : c)), L.edges),
  }), [L])
  const order = truth.order
  const preds = (id) => L.edges.filter((e) => e[1] === id).map((e) => e[0])
  const name = (id) => (by[id].grid ? tr("第 {value} 行第 {value2} 列的路口", {value: +id.split(',')[0] + 1, value2: +id.split(',')[1] + 1}) : tr("「{label}」", {label: by[id].label}))
  const valIn = (vs, id) => (id === L.start ? 1 : vs[id] ?? null)
  const valOf = (id) => valIn(vals, id)
  const empties = L.cells.filter((c) => c.id !== L.start && valOf(c.id) === null).length
  const total = L.cells.length - 1

  const onCell = (id) => {
    if (id === L.start) {
      toast(tr("起点已经填好了：到这里的路线算 1 条"))
      return
    }
    const next = sel === id ? null : id
    setSel(next)
    setInput(next && vals[id] != null ? String(vals[id]) : '')
  }
  const key = (k) => {
    if (!sel) return
    if (k === 'close') {
      setSel(null)
      return
    }
    if (k === 'del') setInput(input.slice(0, -1))
    else if (k === 'ok') {
      const next = { ...vals, [sel]: input === '' ? null : Number(input) }
      setVals(next)
      setMarks(({ [sel]: _, ...rest }) => rest)
      save({ vals: next })
      setSel(order.find((id) => id !== L.start && valIn(next, id) === null) || null)
      setInput('')
    } else if (input.length < 4) setInput((input === '0' ? '' : input) + k)
    buzz(5)
  }
  useWorkspaceKeys((event) => sel && typing(event, key))

  const check = () => {
    if (empties) {
      toast(tr("还有 {empties} 个{value}没填", {empties, value: L.grid ? '路口' : '地点', value2: L.grid ? 'crossing' : 'place', value3: empties === 1 ? ' is' : 's are'}))
      buzz(20)
      return
    }
    const wrong = order.filter((id) => valOf(id) !== truth.val[id])
    setMarks(Object.fromEntries(order.filter((id) => id !== L.start).map((id) => [id, wrong.includes(id) ? 'bad' : 'ok'])))
    if (!wrong.length) {
      verdict.pass({ vals })
      return
    }
    const w = wrong[0], ps = preds(w), pv = ps.map(valOf), right = truth.val[w], mine = valOf(w), n = wrong.length
    const body = () => {
      const from = ps.map(name).join(tr("和"))
      return ps.length === 1
        ? tr("指向{value}的箭头只来自{from}，所以它和{from}一样，是 <b>{value2}</b>。你填的是 <b>{mine}</b>。", {value: name(w), from, value2: pv[0], mine})
        : tr("指向{value}的箭头来自{from}，它们的数是 {value3}，所以应该是 <b>{value2} = {right}</b>。你填的是 <b>{mine}</b>。", {value: name(w), from, value2: pv.join(' + '), right, mine, value3: { zh: String(pv.join(' 和 ')), en: String(pv.join(' and ')) }})
    }
    verdict.fail({ head: lazy(() => tr("{n} 处填得不对", {n, value: n === 1 ? ' is' : 's are'})), body: lazy(() => tr("红框是填错的格子。先看第一个：{value}", {value: body()})) })
  }

  const pr = sel ? preds(sel) : []
  const scene = {
    cells: L.cells.map((c) => {
      const v = valOf(c.id)
      const cls = [c.id === L.start ? 'src' : '', sel === c.id ? 'sel' : '', pr.includes(c.id) ? 'pred' : '', marks[c.id] || '']
      const base = by[c.id].grid ? { w: 58, h: 58, corner: c.id === L.start ? W.start : c.id === L.end ? W.end : '' } : { w: 84, h: 64, label: c.label }
      return { id: c.id, x: c.x, y: c.y, ...base, value: sel === c.id ? (input || '_') : v === null ? '' : v, cls: cls.filter(Boolean).join(' '), tap: true, aria: name(c.id) }
    }),
    edges: L.edges.map(([a, b]) => E(a, b, b === sel ? 'hot' : by[a].grid ? 'dim' : 'idle')),
  }
  const filled = total - empties
  return {
    drawing: boardDrawing(scene, { label: tr("棋盘"), maxScale: 1.25 }, onCell),
    note: sel ? tr("指向{value}的箭头来自：{value2}", {value: name(sel), value2: { zh: String(pr.map(name).join('、')), en: String(pr.map(name).join(', ')) }}) : tr("已填 {filled} / {total}", {filled, total}),
    cards: [{
      title: tr("规则"),
      rule: [tr("到一个地点的路线数"), tr("= 所有指向它的地点的路线数之和")],
      body: tr("起点算 <b>1</b>。选中一个{value}后，它的「上一站」会亮起黄色虚框，指向它的箭头会变成黄色。", {value: { zh: String(L.grid ? '路口' : '地点'), en: String(L.grid ? 'crossing' : 'place') }}),
    }],
    dock: sel
      ? { pad: { title: tr("到{value}的路线数", {value: name(sel)}), value: input, onKey: key } }
      : { meta: tr("已填 <b>{filled}</b> / {total}", {filled, total}), go: { label: text(WORDS.check), icon: 'check', onClick: check } },
  }
}
