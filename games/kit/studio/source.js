import { referenceKey, sourceValue } from '../engine/catalogs.js'
import { textKey, withTextKey } from '../engine/i18n.js'
import { sameJson } from '../engine/json-value.js'
import { getAt, showPath } from '../engine/ops/edit.js'
import { setAt } from '../engine/ops/identity.js'
import { studioProjections } from './editors.js'
import { find, validate } from '../engine/schema.js'
import { tr } from '../shell/i18n.js'
import { changesType, gameFields, opFor, taskListOps } from './form.js'
import { namespaceOf } from './objects-edit.js'
import { objectSchema } from './object-file.js'

const changedKeys = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])]
  .filter((key) => !sameJson(before[key], after[key]))

/** The namespace whose file is shown, even for an object opened from a dependency. */
export function sourceNamespace(file, content) {
  if (file.object) return namespaceOf(file.object.full)
  if (file.level) return namespaceOf(file.level)
  return file.game ? `@${content.id}` : content.packageTarget?.id
}

/** Resolve selected keys against the pending preview's catalog and keep their identity for the op tool. */
function sourceTexts(file, content, owner, vocabulary) {
  const texts = new Map()
  const visit = (value) => {
    const key = textKey(value)
    if (key) texts.set(key, value)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(file.game ? gameFields(content) : file.object ? content.registries : [content.levels, ...Object.values(studioProjections(vocabulary)).map(projection => projection.read(content))])
  return (key) => {
    const full = owner && !key.includes('/') ? `${owner}/${key}` : key
    let copy = texts.get(full)
    if (!copy) {
      const entries = Object.entries(content.registries?.i18n ?? {}).flatMap(([id, text]) => {
        const split = id.indexOf(':')
        return id.slice(split + 1) === full ? [[id.slice(0, split), text]] : []
      })
      if (entries.length) copy = withTextKey(Object.fromEntries(entries), full)
    }
    if (!copy) throw new Error(tr("当前配置的语言文件里没有文案键 @{key}。", {key}))
    return file.game ? withTextKey(copy, key) : copy
  }
}

/** Plan a raw configuration edit while keeping catalog, definition, and task identities intact. */
export function sourceOps(file, before, path, value, vocabulary, content) {
  const owner = sourceNamespace(file, content)
  const source = sourceValue(before, owner)
  const edited = setAt(source, path, value)
  if (sameJson(source, edited)) return []
  const schema = file.object ? objectSchema(file.object.kind, file.object) : file.level ? vocabulary.level : file.schema ?? vocabulary.game
  const existingLiterals = new Set(find(schema, before, 'text', { vocabulary })
    .map(({ value }) => value).filter((value) => typeof value === 'string'))
  const inline = find(schema, edited, 'text', { vocabulary }).find(({ path, value }) =>
    typeof value === 'string' && !referenceKey(value) && !existingLiterals.has(value) && typeof getAt(before, path) !== 'string')
  if (inline) {
    const at = showPath(inline.path)
    throw new Error(tr("{at}：请在文案页编辑各语言的文字。", {at}))
  }
  const read = sourceTexts(file, content, owner, vocabulary)
  let after = edited
  for (const { path, value } of find(schema, edited, 'text', { vocabulary })) {
    const key = referenceKey(value)
    if (key) after = setAt(after, path, read(key))
  }
  if (changesType(schema, before, after, vocabulary)) {
    throw new Error(tr("已有配置的类型不能直接更改。请删除旧项后新增。"))
  }
  const existing = new Set(validate(schema, before, { vocabulary }).map(({ at, says }) => `${at}: ${says}`))
  const invalid = validate(schema, after, { vocabulary }).find(({ at, says }) => !existing.has(`${at}: ${says}`))
  if (invalid) throw new Error(`${invalid.at}: ${invalid.says}`)
  const op = (keys, next) => opFor(file, keys, next === undefined ? { unset: true } : { set: next })

  if (file.projection?.sourceOps) return file.projection.sourceOps({ before, after, content, changedKeys, op })

  if (file.level && path.length === 1 && path[0] === 'tasks') return taskListOps(file.level, before.tasks ?? [], after.tasks, content.levels)
  if (path.length) return [op(path, getAt(after, path))]
  return changedKeys(source, edited).flatMap((key) => file.level && key === 'tasks'
    ? taskListOps(file.level, before.tasks ?? [], after.tasks, content.levels)
    : [op([key], after[key])])
}
