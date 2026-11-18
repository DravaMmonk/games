// Link equal letters of two strings without crossing lines: the most lines is their longest common subsequence.
import { useState } from 'react'
import { lcsLen } from '../../../core/model/algo.js'
import { E } from '../../../core/model/scene.js'
import { tr } from '../../../core/lang.js'
import { boardDrawing } from '../scene.js'
import { reduced } from 'kernel/view'
import { buzz, useLater, useVerdict } from 'kernel/view'

export default function useLink({ level, saved, save, solve, fail, toast }) {
  const L = level.source
  const [ti, setTi] = useState(0)
  const [links, setLinks] = useState(() => L.tests.map((_, k) => saved?.links?.[k] || []))
  const [sel, setSel] = useState(null)
  const [flash, setFlash] = useState(null)
  const [hint, setHint] = useState(false)
  const verdict = useVerdict({ hints: L.hints, solve, fail })
  const later = useLater()
  const target = (k) => lcsLen(L.tests[k].a, L.tests[k].b)
  const solvedIn = (all, k) => all[k].length >= target(k)
  const t = L.tests[ti], mine = links[ti]

  const selectTest = (k) => {
    setTi(k)
    setSel(null)
    setFlash(null)
    setHint(false)
  }
  const keep = (all) => {
    setLinks(all)
    save({ links: all })
  }
  const withLinks = (list) => links.map((x, k) => (k === ti ? list : x))

  const onCell = (id) => {
    const side = id[0], idx = +id.slice(1)
    setFlash(null)
    const at = mine.findIndex((l) => (side === 'a' ? l[0] : l[1]) === idx)
    if (!sel && at >= 0) {
      keep(withLinks(mine.filter((_, k) => k !== at)))
      toast(tr("拆掉了一根线"))
      return
    }
    if (!sel || sel.side === side) {
      setSel(sel && sel.side === side && sel.idx === idx ? null : { side, idx })
      buzz(5)
      return
    }
    const i = side === 'a' ? idx : sel.idx, j = side === 'b' ? idx : sel.idx
    setSel(null)
    if (t.a[i] !== t.b[j]) {
      toast(tr("「{value}」和「{value2}」不一样，不能连", {value: t.a[i], value2: t.b[j]}))
      buzz(20)
      return
    }
    if (mine.some((l) => l[0] === i || l[1] === j)) {
      toast(tr("每个字最多连一根线。先点它，拆掉原来的线"))
      buzz(20)
      return
    }
    const cross = mine.filter((l) => (l[0] - i) * (l[1] - j) < 0)
    if (cross.length) {
      const shown = { links: cross, try: [i, j] }
      setFlash(shown)
      toast(tr("线不能交叉"))
      buzz([20, 40, 20])
      later(() => setFlash((f) => (f === shown ? null : f)), 1200)
      return
    }
    const all = withLinks([...mine, [i, j]].sort((p, q) => p[0] - q[0]))
    keep(all)
    buzz(8)
    if (!solvedIn(all, ti)) return
    if (L.tests.every((_, k) => solvedIn(all, k))) {
      later(() => verdict.pass({ links: all }), reduced() ? 0 : 500)
      return
    }
    toast(tr("第 {ti} 题完成", {ti: ti + 1}))
    const nx = L.tests.findIndex((_, k) => !solvedIn(all, k))
    later(() => selectTest(nx), 900)
  }

  const { a, b } = t, sp = 50, sz = 44, n = Math.max(a.length, b.length)
  const oa = ((n - a.length) * sp) / 2, ob = ((n - b.length) * sp) / 2, fl = flash ? flash.links : []
  const la = new Set(mine.map((l) => l[0])), lb = new Set(mine.map((l) => l[1]))
  const isFl = (i, j) => fl.some((l) => l[0] === i && l[1] === j)
  const cls = (side, idx) => {
    const linked = side === 'a' ? la.has(idx) : lb.has(idx), selected = sel && sel.side === side && sel.idx === idx
    const flashed = flash && (side === 'a' ? flash.try[0] === idx || fl.some((l) => l[0] === idx) : flash.try[1] === idx || fl.some((l) => l[1] === idx))
    return ['tile', selected ? 'sel' : '', flashed ? 'bad' : linked ? 'ok' : ''].filter(Boolean).join(' ')
  }
  const edges = mine.map(([i, j]) => E(`a${i}`, `b${j}`, isFl(i, j) ? 'linkbad' : 'link'))
  if (flash) edges.push(E(`a${flash.try[0]}`, `b${flash.try[1]}`, 'linkbad'))
  const scene = {
    cells: [
      ...[...a].map((ch, i) => ({ id: `a${i}`, x: oa + i * sp, y: 0, w: sz, h: sz, value: ch, cls: cls('a', i), tap: true, aria: tr("上面第 {i} 个字 {ch}", {i: i + 1, ch}) })),
      ...[...b].map((ch, j) => ({ id: `b${j}`, x: ob + j * sp, y: 150, w: sz, h: sz, value: ch, cls: cls('b', j), tap: true, aria: tr("下面第 {j} 个字 {ch}", {j: j + 1, ch}) })),
    ],
    edges,
  }
  return {
    tests: L.tests.map((x, k) => ({ label: `${tr("第 {k} 题", {k: k + 1})} · ${x.a} / ${x.b}` })),
    states: L.tests.map((_, k) => solvedIn(links, k) ? 'pass' : null),
    ti,
    onTest: selectTest,
    drawing: boardDrawing(scene, { label: tr("棋盘"), maxScale: 1.3 }, onCell),
    note: sel ? tr("已选中{value2}的「{value}」，再点另一行里相同的字。", {value: t[sel.side][sel.idx], value2: sel.side === 'a' ? '上面' : '下面', value3: sel.side === 'a' ? 'top' : 'bottom'}) : tr("连上的字从左往右读，就是两串字共有的一串。"),
    cards: [{
      title: tr("三条规则"),
      body: [tr("1. 只能连<b>相同</b>的字"), tr("2. 每个字最多连<b>一根</b>线"), tr("3. 线<b>不能交叉</b>")],
    }, {
      title: tr("连出的公共子序列"),
      badge: `${mine.length} / ${target(ti)}${tr(" 个字")}`,
      tokens: { items: mine.map(([i]) => a[i]), empty: tr("还没有连线") },
    }, {
      title: tr("卡住了？"),
      body: hint ? L.hints[ti] : null,
      action: hint ? null : { label: tr("看提示"), run: () => setHint(true) },
    }],
    dock: {
      meta: tr("已连 <b>{length}</b> 根 · 目标 <b>{value}</b> 根", {length: mine.length, value: target(ti)}),
      secondary: mine.length ? { label: tr("清空这题"), icon: 'trash', onClick: () => { keep(withLinks([])); setSel(null) } } : null,
    },
  }
}
