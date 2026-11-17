// What an editor shows of a value it writes while its writes are still pending (games/DESIGN.md 6.7): every edit is
// at once an operation of the changeset, and the editor shows it before the preview comes back, so editing never
// waits on the server. The relation board (RelationBoard.jsx) and the route map (ChapterBoard.jsx) use it.

/**
 * The value shown: the editor's own last write still in the changeset; else, while the preview still carries writes
 * since taken back (undo), the value before the first of them; else the value as the preview has it (`saved`).
 * `written(op)`: what the editor wrote with that operation ({ value, before }), or null; `touches(op)`: whether an
 * operation edits the value (a later edit made elsewhere leaves the preview's value in charge).
 */
export function pendingValue(saved, ops, previewOps, written, touches) {
  for (let k = ops.length - 1; k >= 0; k--) {
    const own = written(ops[k])
    if (own) return own.value
    if (touches(ops[k])) return saved
  }
  const live = new Set(ops)
  const undone = (previewOps ?? []).find((op) => written(op) && !live.has(op))
  return undone ? written(undone).before : saved
}

/**
 * An editor's record of what it wrote: `write(list, value, before)` notes the operations it hands the changeset;
 * `written(op)` finds one of them again. Kept with the operations themselves (a WeakMap), so an undo (an operation
 * out of the changeset) and a redo (the same operation back) find it; `key` tells one editor's value from another's.
 */
export function writtenBy(key, store) {
  return {
    note: (list, value, before) => { for (const op of list) store.set(op, { key, value, before }) },
    written: (op) => (store.get(op)?.key === key ? store.get(op) : null),
  }
}
