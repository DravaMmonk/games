import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel, pluginMeanings } from '../../../games/kit/engine/plugins.js'
import { projectVocabulary } from '../../../games/kit/engine/kind-meanings.js'
import { vocabularyFor } from '../../../games/kit/engine/kernel.js'
import { packageCodeProblems } from '../../../games/kit/engine/plugin-boundaries.js'
import { register, operations } from '../core/index.js'

test('scalarlib registers executable operations and their signatures without circuit', () => {
  const kernel = createPluginKernel()
  register(kernel.forPackage('scalarlib', 'core'))
  assert.deepEqual(packageCodeProblems('scalarlib', new URL('../../../', import.meta.url).pathname), [])
  assert.equal(kernel.tables.play.size, 0)
  const base = vocabularyFor()
  const vocabulary = projectVocabulary({ ...base, meanings: pluginMeanings(kernel) })
  const { args, returns, run } = vocabulary.capabilities.operation['scalarlib/add']
  assert.deepEqual(args.map(arg => arg.type), ['kernel/number', 'kernel/number'])
  assert.equal(returns, 'kernel/number')
  assert.ok(vocabulary.kinds.valueType[returns])
  assert.equal(run, undefined)
  assert.equal(operations['scalarlib/add'].run([2, 3]), 5)
  assert.throws(() => operations['scalarlib/add'].run(['2', 3]), /not a number/)
  assert.equal(operations['scalarlib/plus'].run(['2', 3]), 5)
  assert.equal(operations['scalarlib/eq'].run([1, '1']), true)
  assert.equal(operations['scalarlib/and'].run([true, false]), false)
  assert.throws(() => operations['scalarlib/over'].run([1, 0]), /divided by 0|除以 0/)
  assert.equal(projectVocabulary({ ...base, meanings: pluginMeanings(kernel, []) }).kinds.operation?.['scalarlib/add'], undefined)
})
