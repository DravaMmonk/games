// Adapt the declaration of a component registry to the authoring tools.
import { S } from "kernel"
import { T as t } from 'kernel/words'
import partViewsSource from '../../shapes/part-views.json' with { type: 'json' }
import fileSchemaSource from '../../shapes/compiled-parts.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const partViews = readCopy(partViewsSource)
const fileSchema = readCopy(fileSchemaSource)

export { default as SETTING } from '../../shapes/resolved-setting.json' with { type: 'json' }
export const PARTS_FILE = fileSchema
export const NAME = S.str({ pattern: fileSchema.fields.parts.keys })
export const FACES = Object.keys(partViews.fields)

/** A new part of each editor, ready to fill in, where the domain's vocabulary gives what it is made of (null: not). */
const BLANKS = {
  circuit: (vocabulary) => (vocabulary?.kinds.operation ? { name: { en: 'New part' }, desc: { en: '' }, icon: 'Box', family: Object.keys(vocabulary.kinds.family ?? {})[0] ?? 'value', op: Object.keys(vocabulary.kinds.operation)[0] } : null),
}
/** Part creation options read by authoring tools. A built part needs a task before it has data. */
export function partCreationOptions(vocabulary, tasks = []) {
  const labels = { circuit: t("电路件") }
  const choices = Object.entries(BLANKS).flatMap(([value, blank]) => {
    const data = blank(vocabulary)
    return data ? [{ value, label: labels[value], data }] : []
  })
  if (tasks.length) choices.push({ value: 'task', label: t("用任务作品搭件") })
  return choices
}

export const builtPart = (reference, name) => ({ name: { en: name }, desc: { en: '' }, inside: [{ id: 'base', reference }] })

/** Translate an assembled part path into its per-object source filename. */
export function partPath(path) {
  const match = /^\.parts\.([^.[\]]+)(.*)$/.exec(path)
  return match ? `parts/${match[1]}.json${match[2]}` : `parts${path}`
}

export function partFileSchema(vocabulary) {
  const declared = vocabulary?.objectKinds?.['circuit/part']?.schema
  return S.obj({ parts: S.map(declared?.type === 'either' ? declared : fileSchema.fields.parts.of, { keys: NAME.pattern }) })
}
