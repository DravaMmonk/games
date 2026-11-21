// A studio workspace's pending changeset (games/design/README.md 6.7), the same in both workspaces: every edit is an operation
// added to it; the server runs it without writing (the preview tool) and answers with the content it leaves, every line
// of the check and each file it changes. A preview comes in two steps, so editing stays quick on a big game: at once the
// content the changeset leaves; then, when there are pending edits, the checks required by those edits.
// Applying replays the changeset and reuses a matching check on the server. Undo runs the
// change log's. `scope` is the workspace's side ('package' or 'game'): the server runs only its operations.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../shell/i18n.js'
import { call } from './api.js'
import { pushOp } from './form.js'
import { latestRequest } from './latest-request.js'

const QUICK = 120 // ms after an edit before its content is previewed
const SETTLE = 700 // ms after the last edit before the whole check starts
// What each call leaves out of the preview's answer. The file texts and the change log (megabytes on a big package)
// are asked for only while the review shows them, once edits settle; the whole check is read for its lines alone.
const QUICK_OMIT = ['changes', 'log', 'drift']
const CHECK_OMIT = ['content', 'changes', 'log', 'drift']
const REVIEW_OMIT = ['content', 'drift']

const opGroups = new WeakMap()
const grouped = (op) => opGroups.has(op)
function groupStart(ops, index) {
  const group = opGroups.get(ops[index])
  if (!group) return index
  while (index > 0 && opGroups.get(ops[index - 1]) === group) index--
  return index
}

/** `target`: a game id, or { package } for a package opened on its own. */
export function useChangeset(target, scope) {
  const game = typeof target === 'string' ? target : JSON.stringify(target)
  const on = typeof target === 'string' ? { game: target } : target
  const [ops, setOps] = useState([])
  const [redo, setRedo] = useState([]) // operations taken back, the last first to come back
  const [why, setWhy] = useState('')
  const [shown, setShown] = useState(null) // the last quick preview that left a content
  const [last, setLast] = useState(null) // the last quick preview (an operation may have failed)
  const [checked, setChecked] = useState(null) // the last whole check: { key, ok, lines, problems }
  const [base, setBase] = useState(null) // the content as written, before the pending changes
  // The seq of the change log's last entry when the game was loaded: a change is written only onto it.
  const [head, setHead] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rev, setRev] = useState(0) // bumped when the files change (apply, undo)
  const [saving, setSaving] = useState(false)
  const [said, setSaid] = useState(null) // what the last apply or undo said

  // A game opened: nothing pending.
  useEffect(() => {
    setShown(null)
    setLast(null)
    setChecked(null)
    setOps([])
    setRedo([])
  }, [game, scope])
  useEffect(() => {
    if (!game) return
    // Asked exactly as the quick preview of an empty changeset is, so the two are one request when nothing is pending.
    call('preview', { ...on, scope, changeset: { ops: [] }, check: false, changesOnly: false, omit: QUICK_OMIT }).then((r) => { setBase(r.content); setHead(r.head) }).catch(() => setBase(null))
  }, [game, scope, rev])

  const draft = useMemo(() => ({ ops }), [ops])
  const changeset = useMemo(() => ({ ...draft, ...(why && { why }) }), [draft, why])
  const key = `${game}|${scope}|${rev}|${JSON.stringify(draft)}`
  const quick = useMemo(latestRequest, [])
  const check = useMemo(latestRequest, [])
  const review = useMemo(latestRequest, [])

  // Every request carries a complete draft. Superseded drafts do not form a backlog in the worker.
  useEffect(() => {
    if (!game) return undefined
    let live = true
    setBusy(true)
    const timer = window.setTimeout(() => quick(async () => {
      if (!live) return
      const r = await call('preview', { ...on, scope, changeset: draft, check: false, changesOnly: Boolean(draft.ops.length), omit: QUICK_OMIT }).catch((error) => ({ ok: false, problems: [error.message], content: null, failed: null }))
      if (!live) return
      setLast({ ...r, ops: draft.ops })
      if (r.content) setShown({ ...r, ops: draft.ops })
      setBusy(false)
    }), draft.ops.length ? QUICK : 0)
    return () => { live = false; window.clearTimeout(timer) }
  }, [game, scope, draft, rev, quick])

  const quickResult = last?.ops === ops ? last : null
  // A local check or a refusal from the quick preview already settles the draft.
  const needsCheck = Boolean(ops.length && quickResult?.ok && !quickResult.checkedChanges)
  useEffect(() => {
    if (!needsCheck) return undefined
    let live = true
    const timer = window.setTimeout(() => check(async () => {
      if (!live) return
      const r = await call('preview', { ...on, scope, changeset: draft, changesOnly: true, omit: CHECK_OMIT }).catch((error) => ({ ok: false, lines: [], problems: [error.message], failed: null }))
      if (live) setChecked({ key, ok: r.ok, lines: r.lines ?? [], problems: r.problems ?? [], failed: r.failed, order: r.order ?? [] })
    }), SETTLE)
    return () => { live = false; window.clearTimeout(timer) }
  }, [game, scope, draft, key, needsCheck, check])

  // The review's files and change log: asked for while a review is open (watchReview), once edits settle.
  const [watching, setWatching] = useState(0)
  const [reviewed, setReviewed] = useState(null) // { key, changes, log, undoable }
  const watchReview = useCallback(() => {
    setWatching((n) => n + 1)
    return () => setWatching((n) => n - 1)
  }, [])
  const reviewing = watching > 0 && shown?.ops === ops
  useEffect(() => {
    if (!game || !reviewing) return undefined
    let live = true
    const timer = window.setTimeout(() => review(async () => {
      if (!live) return
      const r = await call('preview', { ...on, scope, changeset: draft, check: false, changesOnly: Boolean(draft.ops.length), omit: REVIEW_OMIT }).catch(() => null)
      if (live && r) setReviewed({ key, changes: r.changes ?? [], log: r.log ?? [], undoable: r.undoable })
    }), draft.ops.length ? SETTLE : 0)
    return () => { live = false; window.clearTimeout(timer) }
  }, [game, scope, draft, key, reviewing, review])

  const savingRef = useRef(false)
  const opsNow = useRef(ops)
  opsNow.current = ops
  const redoNow = useRef(redo)
  redoNow.current = redo
  // An edit (standing for the last when it edits the same thing), several operations at once, the last taken back and put again.
  const edit = useCallback((op) => { if (!savingRef.current) { setOps((list) => grouped(list.at(-1)) ? [...list, op] : pushOp(list, op)); setRedo([]) } }, [])
  const addOps = useCallback((list, reason = null, { atomic = false } = {}) => {
    if (savingRef.current) return
    if (atomic) {
      const group = {}
      for (const op of list) opGroups.set(op, group)
    }
    setOps((now) => [...now, ...list])
    setRedo([])
    if (reason) setWhy((w) => w || reason)
  }, [])
  const back = useCallback((k) => {
    if (savingRef.current) return
    const now = opsNow.current
    if (k >= now.length) return
    const start = groupStart(now, k)
    setRedo((r) => [...r, ...now.slice(start).reverse()])
    setOps(now.slice(0, start))
  }, [])
  const again = useCallback(() => {
    if (savingRef.current) return
    const r = redoNow.current
    if (!r.length) return
    const start = groupStart(r, r.length - 1)
    setOps((now) => [...now, ...r.slice(start).reverse()])
    setRedo(r.slice(0, start))
  }, [])
  const remove = (k) => {
    setOps((list) => {
      const group = opGroups.get(list[k])
      return list.filter((op, i) => group ? opGroups.get(op) !== group : i !== k)
    })
    setRedo([])
  }
  const discard = () => {
    if (!window.confirm(tr("确定放弃所有待定操作吗？"))) return
    setOps([])
    setRedo([])
  }
  const open = (cs) => { setOps(cs.ops); setRedo([]); setWhy(cs.why ?? '') }
  const apply = async () => {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    try {
      const r = await call('modify', { ...on, scope, changeset: { ...changeset, by: 'studio' }, base: head, changesOnly: true })
      setSaid(r.ok ? { ok: true, text: r.says.join('; ') } : { ok: false, text: r.problems.join('\n') })
      if (r.ok) {
        setOps([])
        setRedo([])
        setWhy('')
        setRev((n) => n + 1)
      }
      return r.ok
    } catch (error) {
      setSaid({ ok: false, text: error.message })
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const undo = async (no) => {
    const r = await call('undo', { ...on, seq: no, changesOnly: true })
    setSaid(r.ok ? { ok: true, text: r.says.join('; ') } : { ok: false, text: r.problems.join('\n') })
    if (r.ok) setRev((n) => n + 1)
  }

  const current = needsCheck ? (checked?.key === key ? checked : null) : quickResult
  const fresh = Boolean(current)
  const lines = useMemo(() => {
    if (current) return current.lines ?? []
    if (!checked || !ops.length) return shown?.lines ?? []
    return [...(shown?.lines ?? []), ...checked.lines.filter((l) => !l.text.startsWith('content: '))]
  }, [checked, current, ops.length, shown])
  const result = { ok: current?.ok === true, problems: last && !last.content ? last.problems : current?.problems ?? [], failed: last?.failed ?? null, says: last?.says ?? shown?.says, removedLevels: quickResult?.removedLevels ?? [], fresh }

  return {
    ops, setOps, redo, why, setWhy, shown, last, checked, base, busy, rev, saving, said, savingRef, changeset, key, fresh, lines, result, reviewed, watchReview,
    content: shown?.content ?? null, edit, addOps, back, again, grouped, remove, discard, open, apply, undo,
  }
}
