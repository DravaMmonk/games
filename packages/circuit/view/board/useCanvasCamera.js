import { useLayoutEffect, useRef } from 'react'

/** Keep camera-only gestures out of circuit rendering and geometry measurement. */
export default function useCanvasCamera(layer, grid, readout) {
  const view = useRef({ x: 0, y: 0, zoom: 1 })
  const pending = useRef(null)
  const frame = useRef(null)

  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (!pending.current) return
    const { x, y, zoom } = pending.current
    view.current = pending.current
    pending.current = null
    layer.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    grid.current.style.backgroundPosition = `${x}px ${y}px`
    grid.current.style.backgroundSize = `${20 * zoom}px ${20 * zoom}px`
    const percent = `${Math.round(zoom * 100)}%`
    if (readout.current.textContent !== percent) readout.current.textContent = percent
  }
  const setView = (next, defer = false) => {
    pending.current = typeof next === 'function' ? next(pending.current ?? view.current) : next
    if (!defer) flush()
    else if (frame.current === null) frame.current = requestAnimationFrame(flush)
  }
  useLayoutEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    pending.current = null
  }, [])
  return { view, setView, flush }
}
