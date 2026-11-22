import { useEffect, useState } from 'react'
import { L, tr } from './i18n.js'

export const chapterIndexText = (chapter) => chapter.kicker ? L(chapter.kicker) : tr('第 {id} 章', { id: chapter.number ?? chapter.id })

export default function ChapterRail({ chapters, list, viewport }) {
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(null)
  const [focused, setFocused] = useState(null)
  const preview = hovered ?? focused
  useEffect(() => {
    const track = list.current
    const scroller = viewport.current
    if (chapters.length < 2) return undefined
    const update = () => {
      const sections = Array.from(track.children)
      const end = scroller.scrollTop > 0 && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1
      const readingLine = scroller.getBoundingClientRect().top + Math.min(scroller.clientHeight / 4, 76)
      setActive(end ? sections.length - 1 : Math.max(0, sections.findLastIndex((section) => section.getBoundingClientRect().top <= readingLine)))
    }
    const resize = new ResizeObserver(update)
    resize.observe(track)
    resize.observe(scroller)
    scroller.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      resize.disconnect()
      scroller.removeEventListener('scroll', update)
    }
  }, [chapters.length, list, viewport])

  if (chapters.length < 2) return null
  return (
    <nav className="map-chapter-rail" aria-label={tr('章节')}>
      <div className="map-chapter-ticks">
        {chapters.map((chapter, index) => {
          const number = chapterIndexText(chapter)
          const title = L(chapter.title)
          return (
            <button
              key={chapter.id}
              type="button"
              aria-label={`${number} · ${title}`}
              aria-current={index === active ? 'location' : undefined}
              data-current-distance={Math.abs(index - active)}
              data-distance={preview === null ? undefined : Math.abs(index - preview)}
              onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(index) }}
              onPointerLeave={() => setHovered(null)}
              onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setFocused(index) }}
              onBlur={() => setFocused(null)}
              onClick={(event) => {
                const section = list.current.children[index]
                section.scrollIntoView({ block: 'start', behavior: 'instant' })
                if (event.detail === 0) section.focus({ preventScroll: true })
              }}
            >
              <span className="map-chapter-label" aria-hidden="true"><small>{number}</small>{title}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
