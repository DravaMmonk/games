import { tableAt } from 'circuit'
import { splitSource } from 'circuit'
import { useEffect, useState } from 'react'
import { tr, lazy } from '../../core/lang.js'
import { robotOf } from '../../core/model/robots.js'
import { picksOf, withPicks } from '../../core/model/board.js'
import { isCard, modelsOf } from '../../core/model/parts.js'
import { signal } from '../../core/model/format.js'
import { recordReads } from '../../core/model/world.js'
import { worldOf } from '../../core/model/task-world.js'
import { guideAt } from '../../core/items/conditions.js'
import { trace } from '../../core/items/traces.js'
import { panelData } from '../../core/items/panels.js'
import { boardDrawing } from './scene.js'
import { robotDrawing, robotWindow } from './robotDrawing.js'
import { missingRobotOutput, robotHint, tutorialFailure } from '../../core/model/verdict.js'
import { probeValues, wireStateOf } from './circuitRun.js'
import { buzz, typing, useToast, useVerdict } from 'kernel/view'
import { useWorkspaceKeys } from 'kernel/view'
import { T } from 'kernel/words'

const empty = { typed: {}, robot: null, selected: null, input: '', focus: null, bench: false }

function sandbox(model, world, task, test, circuit, state, workshopParts) {
  const cell = state.robot || world.sample(test, task)
  const keys = world.keys(test, cell)
  const shown = new Map(world.base?.(test, task) ?? [])
  for (const [key, value] of Object.entries(state.typed)) shown.set(key, value)
  const { reads, empty, get } = recordReads(shown)
  const probe = {}
  try {
    const { out } = model.evaluate(circuit, (id, layer) => world.read(test, cell, id, get, task, layer), world.outs.map(([key]) => key), probe, undefined, workshopParts)
    for (const [id, key] of Object.entries(keys)) shown.set(key, out[id])
  } catch {
    // A partial circuit still shows what it reached on the selected cell.
  }
  return { cell, at: Object.values(keys), shown, reads, empty, probe, typed: new Set(Object.keys(state.typed)), sel: state.selected }
}

function visible(run, at, ended, state) {
  if (!run || at < 0 || state.bench) return null
  const { res, view } = run.report
  return { ...view, k: at + 1, end: ended, focus: state.focus, res }
}

function observe(view, box) {
  if (!view) return box
  const stepAt = view.focus ?? view.k - 1
  const { cell, reads, empty, probe } = view.res.steps[stepAt]
  return {
    cell, probe,
    shown: tableAt(view.res, stepAt + 1),
    reads: new Set(reads),
    empty: new Set(empty === undefined ? [] : [empty]),
  }
}

function noteOf(task, world, view, k) {
  if (!view) return ''
  const step = view.res.steps[view.focus ?? view.k - 1]
  const where = world.where(step.cell)
  if (!view.end) return tr("{value}正在算{where}", {where, value: { zh: String(step.round ? `第 ${step.round} 轮 · ` : ''), en: String(step.round ? `Round ${step.round} · ` : '') }})
  if (view.focus != null) return tr("正在看{where}，再点一次取消。", {where})
  if (view.halt) return tr("机器在{where}出了错。", {where})
  const { rounds, value } = view.res
  const scans = rounds ? tr("扫了 {rounds} 轮，最后一轮一格也没变。", {rounds, value: rounds === 1 ? '' : 's'}) : ''
  return scans + (view.pass
    ? tr("答案 {value}，正确。", {value: signal(value)})
    : tr("机器算出 {value}，应该是 {value2}。", {value: signal(value), value2: signal(task.expected[k])}))
}

/** The robot's world, drawing and card controls. Editing, tests and playback belong to the circuit screen. */
export function useRobotWorld({ screen, task, test, run, report, at, ended, circuit, change, version, held, workshopParts }) {
  const { game, level, solve, fail, progress } = screen
  const { model } = game.table
  const world = worldOf(task)
  const robot = robotOf(task.robot)
  const [state, setState] = useState(empty)
  const [toast, notice] = useToast()
  const verdict = useVerdict({ hints: task.hints, solve, fail })
  const put = (patch) => setState((old) => ({ ...old, ...patch }))
  useEffect(() => setState(empty), [run.at, run.run?.id])
  useEffect(() => put({ focus: null, bench: false }), [version])
  useEffect(() => {
    if (task.unlockToast && !progress.data[task.taskId]) toast(task.unlockToast)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const view = !run.run ? null : visible(report, at, ended, state)
  const live = Boolean(run.run && !run.run.over)
  const box = view ? null : sandbox(model, world, task, test, circuit, state, workshopParts)
  const read = (id, cell, values, layer) => world.read(test, cell, id, (key) => values.get(key) ?? null, task, layer)
  const observation = observe(view, box)
  const { cell, shown, probe } = observation
  const ui = robotWindow({
    world, test, task, robot, ...observation, lit: circuit.nodes.flatMap(picksOf),
    readFact: (id) => read(id, cell, shown, 'self'),
  })
  const onCell = (id) => {
    if (live) return
    if (!view) {
      put({ selected: state.selected === id ? null : id, input: '' })
      buzz(6)
      return
    }
    if (!view.end) return
    const focus = view.res.steps.slice(0, view.k).findLastIndex((step) => step.at.includes(id))
    if (focus < 0) return
    put({ focus: view.focus === focus ? null : focus })
    buzz(6)
  }
  const key = (k) => {
    const { selected, input, typed } = state
    if (k === 'close') put({ selected: null })
    else if (k === 'del') put({ input: input.slice(0, -1) })
    else if (k === 'bot') {
      put({ robot: world.cellOf(test, selected, task), selected: null, input: '' })
      buzz(8)
    } else if (k === 'ok') {
      const rest = { ...typed }
      delete rest[selected]
      put({ typed: input === '' ? rest : { ...rest, [selected]: +input }, selected: null, input: '' })
      buzz(8)
    } else if (input.length < 3) put({ input: (input === '0' ? '' : input) + k })
  }
  useWorkspaceKeys((event) => {
    if (!state.selected) return
    if (event.key === 'Escape') put({ selected: null, input: '' })
    else typing(event, key)
  })
  const toggle = (sensor) => {
    if (live) return
    const node = circuit.nodes.find((n) => task.given.offers[n.type]?.includes(sensor))
    if (!node) return
    const picks = picksOf(node), order = task.given.offers[node.type]
    const next = picks.includes(sensor) ? picks.filter((p) => p !== sensor) : order.filter((p) => p === sensor || picks.includes(p))
    change({
      ...circuit,
      nodes: circuit.nodes.map((n) => n.id === node.id ? withPicks(n, next) : n),
      wires: circuit.wires.filter(({ from }) => { const [id, pick] = splitSource(from); return id !== node.id || next.includes(pick) }),
    })
    buzz(6)
  }
  const choices = (type) => {
    const family = modelsOf(type) ?? []
    return family.filter((name) => name === type || held.has(name)).map((name) => [name, model.def(name).tag])
  }
  const pad = !live && state.selected ? {
    title: tr("{value}：填一个数（不填 = 清空这一格）", {value: world.name(state.selected)}),
    value: state.input,
    onKey: key,
    extra: world.cellOf(test, state.selected, task) && !box?.at.includes(state.selected) ? { key: 'bot', label: tr("让机器人站到这一格") } : null,
  } : null
  const scene = { ...world.scene(test, view, { ...task, ...(view?.end && view.pass && task.trace ? trace(task.trace, test) : {}), bench: box }), look: robot.look }
  const after = task.panel ? panelData(task.panel, test, view, run.states) : null
  const values = probeValues(probe)
  return {
    notice,
    pad,
    busy: live,
    trace: view ? view.res.traces[view.focus ?? view.k - 1] : null,
    text: [task.mission.goal, task.mission.how],
    hint: task.hints ?? null,
    tip: guideAt(task.guide, circuit) ?? ([task.ask, task.tip].filter(Boolean).join(' ') || null),
    value: { values, errors: new Map() },
    drawing: boardDrawing(scene, { label: tr("棋盘"), ...(task.boardOpt || { minScale: 0.7, maxScale: 1.25 }) }, onCell),
    note: noteOf(task, world, view, run.at),
    after,
    returnAction: view?.end && !live ? { label: T("回到棋盘测试"), onClick: () => put({ bench: true, focus: null }) } : null,
    cardDrawing: (node, readOnly) => isCard(node.type) ? robotDrawing(ui, node.type, readOnly ? null : toggle) : null,
    portValue: (node, port) => isCard(node.type) ? signal(read(port, cell, shown, 'self')) : undefined,
    wireState: wireStateOf(values),
    choices: (node) => choices(node.type),
    swap: (node, type) => {
      if (live) return
      change({ ...circuit, nodes: circuit.nodes.map((n) => n.id === node.id ? { ...n, type } : n) })
      buzz(8)
    },
    guard: () => {
      const missing = missingRobotOutput(task, circuit)
      if (!missing) return false
      toast(missing)
      buzz(20)
      return true
    },
    fail: (last, runs) => {
      if (last.final) {
        verdict.fail({ head: T("还不能做成元件"), body: last.final, hint: null })
        return
      }
      const bad = runs[last.test]
      if (task.onFail) {
        verdict.fail({
          ...tutorialFailure(task, last.test, bad.report.res),
          cta: { label: task.onFail.next, fn: () => { solve(null); level.steps.go(task.task + 1) } },
          hint: null,
          panel: panelData(task.onFail.show, task.tests[0]),
        })
        return
      }
      const before = verdict.fails.current
      const hintFor = () => robotHint(task, circuit, before - 1)
      verdict.fail({ ...bad.failure, hint: hintFor() ? lazy(hintFor) : null })
    },
    solve: () => verdict.pass(),
  }
}
