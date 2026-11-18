import { tr } from 'kernel/words'
import { partFileSchema } from './parts/schema.js'

export const partProjection = {
  read: content => content.partDefs ?? { parts: {} },
  schema: partFileSchema,
  sourceFile(_value, path) {
    return path[0] === 'parts' && path[1] ? `parts/${path[1].split('/').at(-1)}.json` : 'parts/'
  },
  edit(_value, keys, edit, type) {
    if (type === 'text' && !edit.unset) {
      return { op: 'text.set', in: 'parts', path: keys, ...(edit.lang ? { lang: edit.lang } : {}), value: edit.set }
    }
    if (edit.unset && keys.length === 2) {
      if (keys[0] === 'parts') return { op: 'part.remove', part: keys[1] }
    }
    if (edit.unset) return { op: 'parts.unset', path: keys }
    return { op: 'parts.set', path: keys, value: edit.set }
  },
  sourceOps({ before, after, changedKeys, op }) {
    const edits = []
    for (const group of ['parts', 'settings']) {
      const old = before[group] ?? {}
      const next = after[group] ?? {}
      for (const id of changedKeys(old, next)) {
        if (!Object.hasOwn(old, id) || !Object.hasOwn(next, id)) {
          throw new Error(tr("请用列表中的新增或删除按钮管理件和设置。"))
        }
        for (const key of changedKeys(old[id], next[id])) edits.push(op([group, id, key], next[id][key]))
      }
    }
    return edits
  },
}
