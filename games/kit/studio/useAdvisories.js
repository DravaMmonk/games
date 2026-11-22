// The advisories of the game or package a workspace has open (games/design/README.md 6.7): asked of the bridge's
// background tool when the content on disk changes and every PERIOD while the page is in view, never on an edit, a
// preview or an apply. A viewer may switch the whole thing off (kept in their browser); a failed run keeps the last.
import { useCallback, useEffect, useState } from 'react'
import { call } from './api.js'
import { usePref } from './prefs.js'
import { useContentRevision } from './useChangeset.js'

const PERIOD = 120_000

/** `target`: a game id or { package }. → { on, toggle(), lines, settle(item) }: `settle` decides an advisory, or reopens a decided one. */
export function useAdvisories(target) {
  const [on, setOn] = usePref('advisories', true)
  const [found, setFound] = useState(null) // { key, lines }
  const rev = useContentRevision()
  const key = typeof target === 'string' ? target : JSON.stringify(target ?? null)
  const ask = useCallback(async (change) => {
    const args = typeof target === 'string' ? { game: target } : target
    const result = await call('advisories', { ...args, ...change }).catch(() => null)
    if (result) setFound({ key, lines: result.lines })
  }, [key])
  useEffect(() => {
    if (!on || !target) return undefined
    const run = () => { if (!document.hidden) ask() }
    run()
    const timer = window.setInterval(run, PERIOD)
    return () => window.clearInterval(timer)
  }, [on, ask, rev])
  const settle = useCallback((item) => ask(item.settled ? { reopen: [item.id] } : { settle: [item.id] }), [ask])
  const toggle = useCallback(() => setOn(value => !value), [setOn])
  return { on, toggle, settle, lines: on && found?.key === key ? found.lines : NONE }
}
const NONE = []
