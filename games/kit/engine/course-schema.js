// Games own chapter membership and route-map rows.
import { S } from './schema.js'
export const COURSE_FIELDS = {
  levels: S.list(S.level(), { tags: false }),
  rows: S.opt(S.list(S.list(S.either(S.level(), S.oneOf([null])), { min: 1, max: 3 }))),
}
export const CHAPTER = S.obj({
  number: S.opt(S.int({ min: 0 })),
  title: S.opt(S.text()), question: S.opt(S.text()), desc: S.opt(S.text()),
  chapter: S.opt(S.obj({ title: S.text(), label: S.opt(S.text()), question: S.opt(S.text()), desc: S.opt(S.text()) })),
  machine: S.opt(S.either(S.str(), S.oneOf([null]))),
  ...COURSE_FIELDS,
})
export const CHAPTERS = S.list(S.str({ reference: 'chapter' }))

/** Add a level schema with its own task shape. Shared required fields stay required. */
export function extendLevelSchema(base, extension, { extensionTasksFirst = false } = {}) {
  if (!base) return extension
  const fields = { ...base.fields, ...extension.fields }
  for (const [key, field] of Object.entries(extension.fields)) {
    if (key === 'tasks') continue
    const previous = base.fields[key]
    const merged = previous ? S.either(previous, field) : field
    fields[key] = !previous || previous.optional || field.optional ? S.opt(merged) : merged
  }
  const taskShapes = [base.fields.tasks.of, extension.fields.tasks.of]
  if (extensionTasksFirst) taskShapes.reverse()
  return S.obj({ ...fields, tasks: S.list(S.either(...taskShapes), { min: 1 }) })
}
