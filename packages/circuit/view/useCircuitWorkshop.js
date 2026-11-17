import { useMemo } from 'react'
import { partsFor, packedView } from "./board/board-parts.js"
import { runtimeOf, workshopView } from "../core/board/workshop-view.js"
import { trayMembers } from "../core/trays.js"
import { captureWorkshop, publishWorkshop, trayKey, workshopAvailable, workshopEntries, workshopIdentity } from "../core/workshop.js"
import { L, tr } from 'kernel/view'

import { useWorkshop } from "./useWorkshop.js"
import { useToast } from 'kernel/view'

/** Project the independent player library onto the current task and its board rules. */
export function useCircuitWorkshop({ screen, course, base, cards, portLabels, defined, defaults, settings, ready }) {
  const { game, level: entry, flags, workshop: profile } = screen
  const level = entry.source
  const definition = base.defined ?? defined
  const { library, update } = useWorkshop()
  const [showNotice, notice] = useToast()
  const offers = useMemo(() => base.offerIn(level, flags), [base, level, flags])
  const has = useMemo(() => base.holdsIn(level, flags), [base, level, flags])
  const identity = (type) => workshopIdentity(game.partDefs, type)
  const runtime = runtimeOf(level, base)
  const taskConstraints = (type, params) => {
    const controls = settings?.({ type, params }, { task: level }) ?? []
    return controls.every(({ key, options }) => !Object.hasOwn(params, key) || options.some(([value]) => Object.is(value, params[key])))
  }
  const offeredTypes = new Set(offers.types)
  const available = (part) => Boolean(profile && workshopAvailable(part, {
    identity, types: offeredTypes, has, allows: taskConstraints, resolve: runtime,
  }))
  const workshop = workshopView(base, library, available, runtime)
  const { known, view: circuit, resolve } = workshop
  const parts = partsFor(level, circuit, { cards, portLabels, defined })
  const packed = packedView(course, { cards, portLabels, defined }, workshop)
  const personal = workshopEntries(library).filter((part) => available(part)
    && !(part.tray && JSON.parse(part.tray)[0] === game.id && offers.types.includes(part.rewardType)))
  const pickedTrays = game.course?.tray(level) ?? []
  const main = new Set((pickedTrays.length ? pickedTrays : ['']).flatMap((tray) => library.featured[trayKey(game.id, tray)] ?? []))
  const palette = [...offers.shown, ...personal.filter(({ id }) => main.has(id)).map(({ id }) => id)]
  const folded = [...offers.folded, ...personal.filter(({ id }) => !main.has(id)).map(({ id }) => id)]
  const types = [...offers.types, ...personal.map(({ id }) => id)]
  const held = new Set(types)
  const hasPersonal = (graph) => graph.nodes.some((node) => Object.hasOwn(library.parts, node.type))
  const hold = (graph) => ready ? ready(graph, level, parts) : graph
  function openForCapture(node, at) {
    const opened = packed.open(node, at)
    return opened && { ...opened, open: (part) => openForCapture(part, opened) }
  }
  const capture = (graph, details) => captureWorkshop(graph, {
    scope: `user_${crypto.randomUUID().replaceAll('-', '')}`,
    open: (node) => openForCapture(node, { level, circuit: graph, parts }),
    needsSnapshot: (type) => Boolean(game.partDefs?.parts?.[type]?.inside),
    ...details, parts: details.parts ?? parts, resolve: runtime, identity,
    defaults: (type) => definition?.of(type) ? definition.defaults(type) : defaults?.(type),
    book: library,
  })
  const put = (part, lineage, rank, replaces) => update((current) => publishWorkshop(current, part, {
    id: part.id, lineage, rank, replaces,
  }))
  const publish = (graph) => {
    if (!profile) return
    const lineage = (type) => JSON.stringify([game.id, type])
    for (const { part: type, variant } of profile.publications[entry.key] ?? []) {
      const part = game.partDefs.parts[type]
      const listed = Object.entries(game.course?.trays ?? {}).find(([, entries]) => trayMembers(entries).includes(type))?.[0]
      const tray = trayKey(game.id, listed ?? pickedTrays[0] ?? '')
      let why = null
      const reward = capture(graph, { name: L(part.name), description: L(part.desc), tray, rewardType: type, why: (problem) => { why = problem } })
      const rank = part.inside.findIndex(({ id }) => id === variant)
      const replaced = (profile.replaces[type] ?? []).map(lineage)
      // Say why, so a pass that cannot be kept can be traced: what on the board stopped it, or the browser's storage.
      if (!reward) showNotice(`${tr('这次通关未能写入工坊', 'This pass could not be published to the workshop')}：${captureProblem(why)}`)
      else if (!put(reward, lineage(type), rank, replaced)) showNotice(tr('这次通关未能写入工坊：浏览器存储已满或不可用。', 'This pass could not be published to the workshop: the browser’s storage is full or unavailable.'))
    }
  }
  return { offers, has, known, circuit, resolve, parts, packed, palette, folded, types, held, hasPersonal,
    hold, capture, publish, library, update, available, notice }
}

/** What stopped a board being kept as a part (captureWorkshop's `why`), in a sentence. */
function captureProblem(why) {
  const at = why?.node ? `「${why.node}」` : ''
  return {
    loop: tr(`元件${at}在自己里面。`, `the part ${at} sits inside itself.`),
    closed: tr(`打不开元件${at}的电路。`, `the board inside ${at} could not be opened.`),
    ports: tr(`元件${at}里的电路和它的接口对不上。`, `the board inside ${at} does not match its ports.`),
    unknown: tr(`这款游戏没有元件${at}。`, `this game has no part ${at}.`),
    unwired: tr('有输出没有接上。', 'an output is not wired.'),
  }[why?.reason] ?? tr('原因不明。', 'unknown reason.')
}
