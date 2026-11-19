// The chapter editor's preview (games/design/README.md 2.6, 6.7): one chapter of the game's map, drawn by
// the shell itself (../shell/LevelMap.jsx MapChapter) in the play page (studio.html?play, play.jsx) with every level
// open. It is handed the content as the preview has it and, apart, the chapter's rows as the map editor leaves them,
// its own pending moves in too. Making a game of the content takes the page (and the studio, on the same thread)
// a second or more, so the page makes it again only when `stamp` says the content changed otherwise than by the
// chapter's rows; a move only draws the tree again (a few milliseconds), so it shows here at once. It follows the
// studio's theme and language. It shows the tree a desktop draws or, at a phone's width, the
// phone's (the author's choice, kept).
import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { getLang, L, T, tr } from '../shell/i18n.js'
import { usePref } from './prefs.js'

/**
 * `content`: the game as it plays; `stamp`: what tells one content from another for the map (it changes when the
 * content changes otherwise than by the rows); `chapter`: the chapter's index; `rows`: its rows as edited (null: the
 * map's rules place it).
 */
export default function MapPreview({ content, stamp, chapter, rows }) {
  const frame = useRef(null)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme)
  useEffect(() => {
    const hear = (event) => { if (event.source === frame.current?.contentWindow && event.data?.type === 'ready') setReady(true) }
    const onTheme = () => setTheme(document.documentElement.dataset.theme)
    window.addEventListener('message', hear)
    window.addEventListener('themechange', onTheme)
    return () => {
      window.removeEventListener('message', hear)
      window.removeEventListener('themechange', onTheme)
    }
  }, [])
  const lang = getLang()
  const [device, setDevice] = usePref('map-preview-device', 'desktop')
  const compact = device === 'phone'
  const send = (message) => frame.current?.contentWindow.postMessage(message, window.location.origin)
  // The content (made into a game there) when its stamp changes; the rows, the chapter and the device on their own.
  const sent = useRef(null)
  useEffect(() => {
    if (!ready || !content) return
    if (sent.current !== stamp) send({ type: 'map', content, chapter, rows, compact, theme, lang })
    else send({ type: 'map-rows', chapter, rows, compact })
    sent.current = stamp
  }, [ready, content, stamp, chapter, rows, compact]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ready) send({ type: 'look', theme, lang })
  }, [ready, theme, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={`effect-preview map-preview is-${device}`} aria-label={tr("路线图预览")}>
      <div className="effect-preview-head">
        <h3>{tr("路线图预览")}</h3>
        <span className="seg" role="radiogroup" aria-label={tr("设备")}>
          {[['desktop', Monitor, T("桌面")], ['phone', Smartphone, T("手机")]].map(([id, Icon, label]) => (
            <button key={id} type="button" role="radio" aria-checked={device === id} className={device === id ? 'is-on' : ''} onClick={() => setDevice(id)} title={L(label)} aria-label={L(label)}>
              <Icon size={13} aria-hidden="true" />
            </button>
          ))}
        </span>
      </div>
      <div className="map-preview-stage">
        <iframe ref={frame} title={tr("路线图预览")} src="/studio.html?play" />
      </div>
    </section>
  )
}
