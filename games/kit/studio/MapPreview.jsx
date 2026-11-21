// Preview the same route the editor is drawing. The play frame refreshes the runtime separately
// for the chapter's titles, icons and progression badges.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { getLang, L, T, tr } from '../shell/i18n.js'
import { usePref } from './prefs.js'

export default function MapPreview({ content, stamp, chapter, rows, edges }) {
  const frame = useRef(null)
  const sent = useRef(null)
  const [ready, setReady] = useState(0)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme)
  useEffect(() => {
    const hear = (event) => {
      if (event.source === frame.current?.contentWindow && event.data?.type === 'ready') {
        sent.current = null
        setReady(value => value + 1)
      }
    }
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
  // Geometry and graph belong to one draft, so the frame receives them together.
  const graph = useMemo(() => JSON.stringify(edges), [edges])
  useEffect(() => {
    if (ready) send({ type: 'map-view', chapter, rows, compact, graph })
  }, [ready, chapter, rows, compact, graph])
  useEffect(() => {
    if (!ready || sent.current === stamp) return
    sent.current = stamp
    send({ type: 'map-runtime', content })
  }, [ready, content, stamp])
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
