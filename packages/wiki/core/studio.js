import { setAt, sourceValue, unsetAt } from 'kernel'
import { T, tr } from 'kernel/words'
import { GLOSSARY } from './schema.js'

/** Name the source represented by an encyclopedia field. */
function glossaryFile(glossary, path) {
  const object = glossary[path[0]]?.[path[1]]
  if (!object?.id) return 'entries/ + tags/entry/'
  return `${path[0] === 'entries' ? 'entries' : 'tags/entry'}/${object.id.split('/').at(-1)}.json`
}

/** Translate the encyclopedia projection's form paths to authored object targets. */
function glossaryTarget(glossary, keys) {
  const object = glossary[keys[0]]?.[keys[1]]
  if (!object?.id) return null
  return { ...(keys[0] === 'entries' ? { entry: object.id } : { tag: object.id, member: 'entry' }), path: keys.slice(2) }
}

export const glossaryProjection = {
  read: content => content.glossary,
  schema: GLOSSARY,
  copyLabel: T('百科'),
  copyTypes: ['entry'],
  fieldPath(glossary, path) {
    if (path[0] !== 'entries' || typeof path[1] !== 'string') return path
    const index = glossary?.entries.findIndex(entry => entry.id === path[1]) ?? -1
    return index === -1 ? null : ['entries', index, ...path.slice(2)]
  },
  pagePath(glossary, path) {
    if (path[0] !== 'entries' || !Number.isInteger(path[1])) return path
    const id = glossary?.entries[path[1]]?.id
    return id ? ['entries', id, ...path.slice(2)] : null
  },
  objectPath(glossary, kind, id) {
    return kind === 'entry' ? this.fieldPath(glossary, ['entries', id]) : null
  },
  objects(glossary) {
    return (glossary?.entries ?? []).map((entry, index) => ({
      id: entry.id, title: entry.title, path: ['entries', index],
    }))
  },
  sourceFile: glossaryFile,
  textTarget(glossary, path) {
    const target = glossaryTarget(glossary, path)
    return target && { name: glossary[path[0]][path[1]].id, target }
  },
  edit(glossary, keys, edit, type) {
    if (type === 'text' && !edit.unset) {
      const target = glossaryTarget(glossary, keys)
      return target && { op: 'text.set', ...target, ...(edit.lang ? { lang: edit.lang } : {}), value: edit.set }
    }
    if (keys[0] === 'entries' && keys[2] === 'group') return null
    if (keys[0] === 'groups' && keys.length >= 3) {
      const target = glossaryTarget(glossary, keys)
      return target ? { op: 'tag.set', ...target, value: edit.unset ? null : edit.set } : null
    }
    if (keys[0] === 'entries' && keys.length >= 3) {
      const entry = glossary.entries[keys[1]]
      const [top, ...rest] = keys.slice(2)
      const value = !rest.length ? (edit.unset ? null : edit.set) : edit.unset ? unsetAt(entry[top], rest) : setAt(entry[top], rest, edit.set)
      return { op: 'entry.patch', entry: entry.id, fields: { [top]: value } }
    }
    if (keys[0] === 'entries' && keys.length === 2 && !edit.unset) {
      const { id, group: _group, ...data } = edit.set
      return { op: 'entry.put', entry: id, data }
    }
    if (keys[0] === 'entries' && keys.length === 2) return { op: 'entry.remove', entry: glossary.entries[keys[1]].id }
    return null
  },
  sourceOps({ before, after, content, changedKeys }) {
    const old = Object.fromEntries(before.entries.map(({ id, group: _group, ...entry }) => [id, entry]))
    const next = Object.fromEntries(after.entries.map(({ id, group: _group, ...entry }) => [id, entry]))
    const ops = changedKeys(old, next).map((entry) => next[entry] === undefined ? { op: 'entry.remove', entry } : { op: 'entry.put', entry, data: next[entry] })
    const oldGroups = Object.fromEntries(before.groups.filter((g) => g.id).map((g) => [g.id, g]))
    const newGroups = Object.fromEntries(after.groups.filter((g) => g.id).map((g) => [g.id, g]))
    for (const tag of changedKeys(oldGroups, newGroups)) {
      const group = newGroups[tag]
      if (!group) ops.push({ op: 'tag.remove', tag, member: 'entry' })
      else ops.push({ op: 'tag.put', tag, member: 'entry', data: { ...sourceValue(content.tags?.[`entry:${tag}`]), title: group.title, values: group.values ?? after.entries.filter((e) => e.group === tag).map((e) => e.id) } })
    }
    if (after.entries.some((entry) => before.entries.find((old) => old.id === entry.id)?.group !== entry.group)) throw new Error(tr("请通过词条标签修改分组。"))
    return ops
  },
}
