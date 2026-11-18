import { shapeAt } from '../schema.js'
import { getAt, parsePath } from './edit.js'
import { setAt } from './identity.js'

export function levelOf(workspace, id) {
  const level = workspace.levels.get(id)
  if (level == null) throw new Error(`no level ${id}`)
  return level
}

export const orderOf = (schema, value, vocabulary) => path => {
  const shape = shapeAt(schema, value, path, { vocabulary })
  return shape?.type === 'obj' ? Object.keys(shape.fields) : null
}

export function setLevel(workspace, id, path, value, vocabulary) {
  const level = levelOf(workspace, id)
  return workspace.levels.set(id, setAt(level, path, value, orderOf(vocabulary.level, level, vocabulary)))
}

/** Build the inverse operation that restores the old value or removes the newly added field. */
export function restore(op, base, path, args) {
  const keys = parsePath(path), value = getAt(base, keys)
  return value === undefined ? { op: `${op}.unset`, ...args, path: keys } : { op: `${op}.set`, ...args, path: keys, value }
}
