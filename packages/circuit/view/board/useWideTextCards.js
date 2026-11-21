import { useLayoutEffect, useState } from 'react'
import { slotWidth } from '../../core/board/card-size.js'

const textFace = ':is(.pb-name, .pb-thumb, .pb-param)'

function textProbes(tile, width) {
  const style = getComputedStyle(tile)
  const contentWidth = width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  return [...tile.querySelectorAll(`:scope > ${textFace}`)]
    .filter(face => face.textContent.trim())
    .map(face => {
      const probe = face.cloneNode(true)
      Object.assign(probe.style, {
        position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
        inset: '0 auto auto 0', width: `${contentWidth}px`, maxWidth: 'none',
        ...(face.classList.contains('pb-name') && { whiteSpace: 'nowrap' }),
      })
      return probe
    })
}

/** Measure the rendered text at one slot's width, even when the card currently spans two slots. */
export function useWideTextCards(boardRef) {
  const [wide, setWide] = useState(() => new Set())
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const measure = () => {
      const cards = []
      for (const grid of board.querySelectorAll('.pb-grid')) {
        const columns = Number(grid.dataset.cols)
        if (columns < 2 || !grid.clientWidth) continue
        const width = slotWidth(grid.clientWidth, columns)
        for (const tile of grid.querySelectorAll(':scope > .pb-cell > .pb-tile')) {
          if (!tile.hasAttribute('data-picture')) cards.push({ tile, probes: textProbes(tile, width) })
        }
      }
      for (const { tile, probes } of cards) tile.append(...probes)
      const next = new Set(cards.filter(({ probes }) => probes.some(probe => probe.scrollWidth > probe.clientWidth + 1))
        .map(({ tile }) => tile.dataset.part))
      for (const { probes } of cards) for (const probe of probes) probe.remove()
      setWide(previous => previous.size === next.size && [...next].every(id => previous.has(id)) ? previous : next)
    }
    measure()
    const observer = new MutationObserver(records => {
      if (records.some(({ target }) => (target.nodeType === 1 ? target : target.parentElement)?.closest(textFace))) measure()
    })
    observer.observe(board, { subtree: true, childList: true, characterData: true })
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  })
  return wide
}
