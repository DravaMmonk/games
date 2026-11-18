// Trace every route on a one-way street map, one click a stop.
import { useMemo, useState } from 'react'
import { allRoutes } from '../../../core/model/algo.js'
import { E } from '../../../core/model/scene.js'
import { tr } from '../../../core/lang.js'
import { boardDrawing } from '../scene.js'
import { reduced } from 'kernel/view'
import { buzz, useLater, useVerdict } from 'kernel/view'

export default function useTrace({ level, saved, save, solve, fail, toast }) {
  const L = level.source
  const [route, setRoute] = useState([])
  const [found, setFound] = useState(() => saved?.found ?? [])
  const [flash, setFlash] = useState(null)
  const verdict = useVerdict({ hints: L.hints, solve, fail })
  const later = useLater()
  const { by, total } = useMemo(() => ({ by: Object.fromEntries(L.cells.map((c) => [c.id, c])), total: allRoutes(L.start, L.end, L.edges).length }), [L])
  const has = (a, b) => L.edges.some((e) => e[0] === a && e[1] === b)
  const name = (id) => by[id].label

  const onCell = (id) => {
    setFlash(null)
    if (!route.length) {
      if (id !== L.start) {
        toast(tr("路线要从「{value}」出发", {value: name(L.start)}))
        buzz(20)
        return
      }
      setRoute([id])
      buzz(6)
      return
    }
    const last = route.at(-1)
    if (id === last) {
      setRoute(route.slice(0, -1))
      return
    }
    if (!has(last, id)) {
      toast(tr("没有从「{value}」通往「{value2}」的单行道", {value: name(last), value2: name(id)}))
      buzz(20)
      return
    }
    const next = [...route, id]
    if (id !== L.end) {
      setRoute(next)
      buzz(6)
      return
    }
    const key = next.join('>')
    let all = found
    if (found.some((r) => r.join('>') === key)) toast(tr("这条路线已经找过了"))
    else {
      all = [...found, next]
      setFound(all)
      toast(tr("找到第 {length} 条路线", {length: all.length}))
      buzz(15)
    }
    setFlash(next)
    setRoute([])
    const work = { found: all }
    save(work)
    if (all.length === total) later(() => verdict.pass(work), reduced() ? 0 : 500)
  }

  const showRoute = route.length ? route : flash || []
  const onRoute = (a, b) => {
    const i = showRoute.indexOf(a)
    return i >= 0 && showRoute[i + 1] === b
  }
  const scene = {
    cells: L.cells.map((c) => {
      const k = showRoute.indexOf(c.id)
      const cls = [k >= 0 ? (route.length ? 'sel' : 'path') : '', c.id === L.start && !route.length ? 'coach' : '']
      return { id: c.id, x: c.x, y: c.y, w: 92, h: 66, label: c.label, value: k >= 0 ? k + 1 : '', cls: cls.filter(Boolean).join(' '), tap: true }
    }),
    edges: L.edges.map(([a, b]) => E(a, b, onRoute(a, b) ? (route.length ? 'sel' : 'good') : 'idle')),
  }
  const walk = (r) => r.map(name).join(' → ')
  return {
    drawing: boardDrawing(scene, { label: tr("棋盘"), maxScale: 1.25 }, onCell),
    note: route.length ? `${tr("当前路线：")}${walk(route)}` : tr("从「{value}」开始点。", {value: name(L.start)}),
    cards: [{
      title: tr("已找到的路线"),
      badge: `${found.length} / ${total}`,
      list: [
        ...(found.length ? found.map((r, k) => ({ text: `${k + 1}. ${walk(r)}` })) : [{ text: tr("还没有"), tone: 'empty' }]),
        ...(route.length ? [{ text: `${tr("正在走：")}${walk(route)}`, tone: 'now' }] : []),
      ],
    }, {
      title: tr("规则"),
      body: tr("只能顺着箭头走。点到「{value}」就记下一条路线；同一条路线只算一次。", {value: name(L.end)}),
    }],
    dock: {
      meta: tr("已找到 <b>{length}</b> / {total} 条", {length: found.length, total}),
      secondary: route.length ? { label: tr("撤销一步"), onClick: () => setRoute(route.slice(0, -1)) } : null,
    },
  }
}
