import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { L, useHistory } from 'kernel/view'
import { tr } from 'kernel/words'
import { Chips, Strip } from './Strip.jsx'
import { StripTools } from './StripTools.jsx'
import { useStrip } from './useStrip.js'
import { treeKey, treePath } from '../../core/tree.js'

// A descendant follows its ancestor. Other paths are ordered by the first differing child.
function follows(path, previous) {
  const other = previous.findIndex((step, i) => path[i] !== step)
  return other < 0 || path[other] > previous[other]
}

/**
 * Edit a work on a strip. The language describes its tree, parts, accepted holes and text. `layout({ tools, strip,
 * note, chips })` places the editor's pieces apart (the strip in a rule row, the tray under it); by default they stack.
 */
const TreeEditor = forwardRef(function TreeEditor({ tree, onChange, chips, language, scope, layout = null }, ref) {
  const { nodeAt, setAt, holesOf, joinsOnto, complete } = language
  const byKey = useMemo(() => new Map(chips.map((chip) => [chip.key, chip])), [chips])
  const [recent, setRecent] = useState(null)
  const lastEdit = recent?.tree === tree && recent.scope === scope ? recent : null
  const holes = holesOf(tree)
  const following = holes.filter(({ path }) => !lastEdit || follows(path, lastEdit.path))
  const replace = (next) => {
    setRecent(null)
    strip.clearSelection()
    onChange(next)
  }
  const history = useHistory(tree, replace, scope, 0)
  const accepts = (hole, chip) => (language.accepts?.(hole, chip) ?? true) && !language.refuse?.(tree, hole.path, chip)
  const strip = useStrip({
    put: (slot, key) => {
      const path = treePath(slot)
      const chip = byKey.get(key)
      const refused = language.refuse?.(tree, path, chip)
      if (refused) return refused
      const made = chip.make(tree)
      const last = nodeAt(tree, path)
      const next = setAt(tree, path, last != null ? setAt(made, holesOf(made)[0].path, last) : made)
      setRecent({ tree: next, scope, path })
      onChange(next)
      return null
    },
    take: (slot) => replace(setAt(tree, treePath(slot), null)),
    target: (key) => {
      const chip = byKey.get(key)
      const made = chip.make(tree)
      const join = joinsOnto(tree, chip, made)
      if (join && !language.refuse?.(tree, join, chip)) return treeKey(join)
      const hole = (complete(made) ? following : holes).find(hole => accepts(hole, chip))
      return hole ? treeKey(hole.path) : null
    },
    filled: (slot) => nodeAt(tree, treePath(slot)) !== null,
    fixed: () => false,
  })
  useImperativeHandle(ref, () => ({ clearSelection: () => {
    strip.clearSelection()
    setRecent(null)
  } }), [strip])
  const first = following[0]
  const next = strip.selected ?? (first ? treeKey(first.path) : complete(tree) ? 'end' : null)
  const groups = language.groups.map(([key, label]) => ({
    key, label,
    chips: chips.filter((chip) => chip.group === key).map((chip) => ({
      key: chip.key, family: key, text: language.chipText?.(chip) ?? chip.text, sub: chip.sub, symbol: chip.symbol,
    })),
  })).filter((group) => group.chips.length)
  const problem = language.problem?.(tree)
  const note = strip.note ?? (problem ? { text: problem, bad: true } : null)
  const pieces = {
    tools: <StripTools history={history} onClear={() => replace(null)} empty={tree == null} />,
    strip: <Strip line={language.line(tree)} label={language.label} next={next} selected={strip.selected} flash={strip.flash} onSlot={strip.onSlot} />,
    note: note ? <p className={`ks-note ${note.bad ? 'is-bad' : ''}`} role="status">{L(note.text)}</p> : <p className="ks-note">{tr('点击文字可以删除。')}</p>,
    chips: <Chips groups={groups} onChip={strip.onChip} />,
  }
  return layout ? layout(pieces) : <>{pieces.tools}{pieces.strip}{pieces.note}{pieces.chips}</>
})

export default TreeEditor
