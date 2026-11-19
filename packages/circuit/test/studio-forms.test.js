import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { runtimeOf } from '../../../games/kit/engine/resolver.js'
import { readStarter } from '../../qed/test/fixture.js'
import { contentVocabulary } from '../../../games/kit/studio/editors.js'
import { boardPaths, formOf, tableOf, tableValue, textsOf } from '../../../games/kit/studio/form.js'

function* fieldsIn(field) {
  yield field
  for (const item of field.items ?? []) yield* fieldsIn(item)
  for (const entry of field.entries ?? []) yield* fieldsIn(entry.field)
  for (const item of field.fields ?? []) if (item.field) yield* fieldsIn(item.field)
  if (field.params) yield* fieldsIn(field.params)
}

test('the circuit starter projects its texts, boards and authored value tables into Studio', async () => {
  const content = readStarter(resolve(import.meta.dirname))
  const vocabulary = contentVocabulary((await runtimeOf(content)).vocabulary, content)
  const levels = content.levels.map(level => level.id)
  const tableFields = new Set()
  for (const { id, ...level } of content.levels) {
    const form = formOf(vocabulary.level, level, { vocabulary, levels })
    const fields = new Map(Array.from(fieldsIn(form), field => [JSON.stringify(field.path), field]))
    for (const { path } of textsOf(vocabulary.level, level, vocabulary)) {
      assert.equal(fields.get(JSON.stringify(path))?.kind, 'text', `${id} ${path.join('.')}`)
    }
    for (const path of boardPaths(vocabulary, level)) {
      assert.equal(fields.get(JSON.stringify(path))?.kind, 'board', `${id} ${path.join('.')}`)
    }
    for (const field of fields.values()) if (field.kind === 'table') {
      const table = tableOf(field)
      assert.deepEqual(tableValue(field, table, table.rows), field.value, `${id} ${field.path.join('.')}`)
      tableFields.add(field.path.at(-1))
    }
  }
  assert.deepEqual([...tableFields].sort(), ['expect', 'inputs', 'publishes'])
})
