import { punctuation } from 'kernel'
// Draw two routes through a maze of a key and doors that make a counterexample: the same cell, one with the key and
// one without, a door next.
import { useState } from 'react'
import { rcName } from '../../../core/model/algo.js'
import { E } from '../../../core/model/scene.js'
import { W } from '../../../core/model/robot-scene.js'
import { L as text } from 'kernel/view'
import { tr } from '../../../core/lang.js'
import { boardDrawing } from '../scene.js'
import { reduced } from 'kernel/view'
import { buzz, useLater, useVerdict } from 'kernel/view'

const rc = (id) => id.split(',').map(Number)

export default function useBreach({ level, solve, fail, toast }) {
  const L = level.source
  const w = L.maze, kid = w.key.join(','), doors = new Set(w.doors.map((d) => d.join(',')))
  const [routes, setRoutes] = useState({ A: [], B: [] })
  const [active, setActive] = useState('A')
  const [msg, setMsg] = useState(null) // { cls, body() } what the check found
  const [tries, setTries] = useState(0)
  const verdict = useVerdict({ hints: L.hints, solve, fail })
  const later = useLater()
  const route = routes[active]
  const gotKey = (r) => r.includes(kid)
  const info = (r) => {
    const x = routes[r]
    return x.length ? tr("{value} 步 · 停在{value2} · {value3}", {value: x.length - 1, value2: rcName(x.at(-1)), value3: gotKey(x) ? '拿了钥匙' : '没拿钥匙', value4: x.length === 2 ? '' : 's', value5: gotKey(x) ? 'has the key' : 'no key'}) : tr("还没开始")
  }
  const setRoute = (r) => setRoutes({ ...routes, [active]: r })

  const onCell = (id) => {
    setMsg(null)
    if (!route.length) {
      if (id !== '0,0') {
        toast(tr("路线要从左上角的起点出发"))
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
    const [r0, c0] = rc(last), [r, c] = rc(id)
    if (!((r === r0 && c === c0 + 1) || (r === r0 + 1 && c === c0))) {
      toast(tr("只能从路线的最后一格，往右或往下走一格"))
      buzz(20)
      return
    }
    if (doors.has(id) && !gotKey(route)) {
      toast(tr("没有钥匙，过不了这扇门"))
      buzz([20, 40, 20])
      return
    }
    setRoute([...route, id])
    buzz(6)
  }

  const check = () => {
    const { A, B } = routes
    const bad = (message) => {
      const n = tries + 1
      setTries(n)
      setMsg({ cls: 'bad', body: () => n >= 2 ? [message(), '', tr("<b>提示</b>：{value}", {value: text(L.hintText)})] : message() })
      buzz([20, 40, 20])
    }
    if (!A.length || !B.length) return bad(() => tr('先画好两条路线。在规则面板里切换 A 和 B。'))
    const ea = A.at(-1), eb = B.at(-1)
    if (ea !== eb) return bad(() => tr('两条路线停在不同的格子：A 在{a}，B 在{b}。计数器当然分得清不同的格子，让它们停在同一格。', { a: rcName(ea), b: rcName(eb) }))
    const both = gotKey(A)
    if (gotKey(A) === gotKey(B)) return bad(() => tr('两条路线{both}钥匙。它们不光状态相同，未来也一样，这不算破绽。让一条拿钥匙，另一条不拿。', { both: both ? tr('都拿了') : tr('都没拿') }))
    const [r, c] = rc(ea), next = [`${r},${c + 1}`, `${r + 1},${c}`].filter((id) => doors.has(id))
    if (!next.length) return bad(() => tr('它们在{cell}汇合，一条有钥匙，一条没有。可从这里往右或往下一步都碰不到门，暂时还看不出区别。让它们在门的左边或上面汇合。', { cell: rcName(ea) }))
    const keyed = gotKey(A) ? 'A' : 'B', other = keyed === 'A' ? 'B' : 'A'
    setMsg({ cls: 'good', body: () => tr("找到了！两条路线都停在{value}。路线 {keyed} 带着钥匙，下一步能穿过{value2}的门；路线 {other} 空着手，过不去。可在只记位置的计数器眼里，它们是同一个状态。", {value: rcName(ea), keyed, value2: rcName(next[0]), other}) })
    buzz(15)
    later(() => verdict.pass({ routes }), reduced() ? 0 : 900)
  }

  const sp = 66, sz = 58, cells = [], edges = [], end = `${w.R - 1},${w.C - 1}`, tail = route.at(-1)
  for (let r = 0; r < w.R; r++) for (let c = 0; c < w.C; c++) {
    const id = `${r},${c}`, a = routes.A.includes(id), b = routes.B.includes(id)
    const cls = [id === kid ? 'key' : '', doors.has(id) ? 'door' : '', a && b ? 'rab' : a ? 'ra' : b ? 'rb' : '', id === tail ? 'sel' : '']
    cells.push({ id, x: c * sp, y: r * sp, w: sz, h: sz, value: a && b ? 'A B' : a ? 'A' : b ? 'B' : '', label: id === kid ? W.key : doors.has(id) ? W.door : '', corner: id === '0,0' ? W.start : id === end ? W.end : '', cls: cls.filter(Boolean).join(' '), tap: true, aria: rcName(id) })
    if (c + 1 < w.C) edges.push(E(id, `${r},${c + 1}`, 'dim'))
    if (r + 1 < w.R) edges.push(E(id, `${r + 1},${c}`, 'dim'))
  }
  routes.A.slice(1).forEach((id, q) => edges.push(E(routes.A[q], id, 'ra', 0, -4)))
  routes.B.slice(1).forEach((id, q) => edges.push(E(routes.B[q], id, 'rb', 0, 4)))

  return {
    drawing: boardDrawing({ cells, edges }, { label: tr("棋盘"), maxScale: 1.2 }, onCell),
    note: tr("正在画路线 {active}。点路线的最后一格可以撤销一步。", {active}),
    cards: [{
      title: tr("两条路线"),
      choices: {
        label: tr("正在画的路线"),
        items: ['A', 'B'].map((r) => ({ label: `${tr("路线")} ${r}`, className: `route-${r}`, current: active === r, select: () => setActive(r) })),
      },
      list: ['A', 'B'].map((r) => ({ text: `${r}${punctuation("：")}${info(r)}`, tone: `r${r.toLowerCase()}-line` })),
      action: { label: tr("清空路线 {active}", {active}), disabled: !route.length, run: () => { setRoute([]); setMsg(null) } },
    }, ...(msg ? [{ title: tr("检验结果"), feedback: msg }] : []), {
      title: tr("合格的反例"),
      body: [tr("1. 两条路线停在<b>同一格</b>：在计数器眼里，它们是同一个状态。"), tr("2. 一条<b>拿了钥匙</b>，一条<b>没拿</b>。"), tr("3. 从这一格往右或往下一步，<b>就是门</b>：它们的未来不同。")],
    }],
    dock: {
      meta: tr("正在画 <b>路线 {active}</b>", {active}),
      secondary: route.length ? { label: tr("撤销一步"), onClick: () => { setRoute(route.slice(0, -1)); setMsg(null) } } : null,
      go: { label: tr("检验"), icon: 'check', onClick: check },
    },
  }
}
