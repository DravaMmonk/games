import { usePointerSession } from 'kernel/view'


import { translateBlock } from "../../core/board/blocks.js"
import { dragOffset } from '../drag.js'

// Preview every member together; commit one layout edit when released, or restore it on cancellation.
export default function useBlockDrag({ graph, parts, layer, view, onChange, redraw, positions }) {
  const { track, cancel } = usePointerSession()
  return (event, block) => {
    if (event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
    const { zoom } = view.current
    const root = layer.current, members = new Set(block.nodes)
    const start = [event.clientX, event.clientY]
    const nodes = [...root.querySelectorAll('[data-part]')].filter(el => el.closest('.board-layer') === root && members.has(el.dataset.part))
    const section = [...root.querySelectorAll('[data-block]')].find(el => el.closest('.board-layer') === root && el.dataset.block === block.id)
    const offsets = [...nodes, section].filter(Boolean).map(dragOffset)
    let dx = 0, dy = 0
    const move = e => {
      dx = Math.round((e.clientX - start[0]) / zoom)
      dy = Math.round((e.clientY - start[1]) / zoom)
      offsets.forEach(offset => offset(dx, dy))
      redraw()
    }
    const finish = commit => {
      offsets.forEach(offset => offset())
      if (commit && (dx || dy)) onChange(translateBlock(graph, parts, block.id, dx, dy, positions), { keep: true })
      redraw()
    }
    track(event, { move, finish, escape: true })
  }
}
