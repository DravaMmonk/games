import { createElement, useMemo, useState } from 'react'
import { CircuitBoard } from 'lucide-react'
import { taskOpen, playedTask, taskContext, playId } from "kernel/view"
import { tr } from 'kernel/words'
import { trayMembers } from 'circuit'

function workshopTrayNames(game) {
  return Object.entries(game.course?.trays ?? {}).filter(([name, tray]) =>
    game.workshop.trays[name]?.workshop !== false && trayMembers(tray).length).map(([name]) => name)
}

export function useWorkshopShell({ game, progress, level, author, solved, phone, theme }) {
  const [bench, setBench] = useState(() => !level && !author ? new URLSearchParams(window.location.search).get('workshop') : null)
  const open = (tray = '') => {
    setBench(tray)
    const url = new URL(window.location.href)
    url.searchParams.set('workshop', tray)
    window.history.replaceState({}, '', url)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const sources = useMemo(() => {
    if (level || author || !game.workshop) return []
    return game.levels.slice().reverse().flatMap(candidate => {
      if (!progress.all && !solved.has(candidate.id)) return []
      return candidate.tasks.map((task, at) => ({ candidate, at, task, kind: game.kinds[playId(task)] }))
        .reverse().filter(({ at, kind }) => kind?.editor === 'circuit' && taskOpen(game, progress, candidate.id, at))
    })
  }, [game, level, author, progress, solved])
  const circuitTrays = useMemo(() => new Set(workshopTrayNames(game)), [game])
  const boards = sources.flatMap(source => {
    const trays = game.course?.tray(source.task.source)?.filter(name => circuitTrays.has(name)) ?? ['']
    return trays.length ? [{ ...source, trays }] : []
  })
  const workshop = (bench && boards.find(({ trays }) => trays.includes(bench))) || boards[0]
  const task = bench !== null && workshop ? playedTask(taskContext(game, progress, workshop.candidate, workshop.at)) : null
  const tray = task && (workshop.trays.includes(bench) ? bench : workshop.trays[0])
  const trays = [...circuitTrays].filter(name => boards.some(({ trays }) => trays.includes(name)))
  return {
    close(url) { setBench(null); url.searchParams.delete('workshop') },
    taskProps: { workshop: !author && game.workshop },
    area: task && {
      title: tr("元件工坊"), leaveLabel: tr("离开元件工坊"),
      content: createElement(workshop.kind.Screen, {
        ...task.screen, key: `${task.key}#${tray}`, phone, theme, workshop: game.workshop,
        workshopOnly: true, workshopTray: tray, workshopTrays: trays, onWorkshopTray: open,
      }),
    },
    mapActions: workshop && <button className="kit-btn is-label" onClick={() => open()}><CircuitBoard size={15} /><span>{tr("元件工坊")}</span></button>,
  }
}
