import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel, pluginMeanings } from '../../../games/kit/engine/plugins.js'
import { projectVocabulary } from '../../../games/kit/engine/kind-meanings.js'
import { vocabularyFor } from '../../../games/kit/engine/kernel.js'
import { packageCodeProblems } from '../../../games/kit/engine/plugin-boundaries.js'
import { register, operations } from '../core/index.js'

test('numlib registers executable operations and their signatures without circuit', () => {
  const kernel = createPluginKernel()
  register(kernel.forPackage('numlib', 'core'))
  assert.deepEqual(packageCodeProblems('numlib', new URL('../../../', import.meta.url).pathname), [])
  assert.equal(kernel.tables.play.size, 0)
  const base = vocabularyFor()
  const vocabulary = projectVocabulary({ ...base, meanings: pluginMeanings(kernel) })
  const { args, returns, run } = vocabulary.capabilities.operation['numlib/add']
  assert.deepEqual(args.map(arg => arg.type), ['kernel/number', 'kernel/number'])
  assert.equal(returns, 'kernel/number')
  assert.ok(vocabulary.kinds.valueType[returns])
  assert.equal(run, undefined)
  assert.equal(operations['numlib/add'].run([2, 3]), 5)
  assert.throws(() => operations['numlib/add'].run(['2', 3]), /not a number/)
  assert.equal(operations['numlib/plus'].run(['2', 3]), 5)
  assert.equal(operations['numlib/eq'].run([1, '1']), true)
  assert.equal(operations['numlib/and'].run([true, false]), false)
  assert.throws(() => operations['numlib/over'].run([1, 0]), /divided by 0|除以 0/)
  assert.equal(projectVocabulary({ ...base, meanings: pluginMeanings(kernel, []) }).kinds.operation?.['numlib/add'], undefined)
})
