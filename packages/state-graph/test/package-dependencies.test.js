import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readPackage, runtimeOf } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { packageWordsFixture, testProject } from '../../../games/kit/engine/test-fixture.js'
import { installTableFixture, installScalarFixture } from '../../qed/test/fixture.js'

test('a mixed library checks each independent level with its own play and dependencies', async () => {
  const { root, put } = testProject('table-package-dependencies-')
  try {
    installTableFixture(root)
    installScalarFixture(root)
    put('packages/numeric-parts/package.json', {
      kind: 'ext', version: '1.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', numlib: '^0.0.0' },
      ...packageWordsFixture(put, 'numeric-parts'),
    })
    put('packages/numeric-parts/parts/add.json', {
      icon: 'Plus', name: 'Add', desc: 'Add two numbers.', family: 'circuit/value',
      inputs: ['a', 'b'].map(name => ({ name, type: 'kernel/number' })),
      outputType: 'kernel/number', op: 'numlib/plus',
    })
    for (const file of ['package.json', 'capabilities', 'core', 'kinds', 'i18n']) {
      cpSync(new URL(`../../text/${file}`, import.meta.url), join(root, 'packages/text', file), { recursive: true })
    }
    put('packages/cells/package.json', {
      kind: 'lib', type: 'module', version: '1.0.0', kernel: '^0.0.0',
      uses: { 'numeric-parts': '^1.0.0', 'state-graph': '^0.0.0', text: '^0.0.0' },
      ...packageWordsFixture(put, 'cells'),
    })
    put('packages/cells/core/index.js', `
      export function register(kernel) {
        kernel.check('cells/levels', ({ content }) => content.levels.map(({ id }) => ({ text: id })))
      }
    `)
    put('packages/cells/levels/double.json', {
      title: 'Double', short: 'Double', intro: [],
      mission: { goal: 'Double the previous cell.', how: 'Use the imported adder.' },
      robot: 'state-graph/scout', debrief: { title: 'Doubled', body: [] },
      tasks: [{
        id: 'double', play: 'state-graph/circuit', world: 'state-graph/grid',
        tests: [{ R: 1, C: 2, given: { '0,0': 7 } }], expected: [14],
        solution: ['sum = numeric-parts/add(view.left, view.left)', 'cell <- sum'],
      }],
    })
    put('packages/cells/levels/prompt.json', {
      title: 'Type hello',
      tasks: [{ id: 'prompt', play: 'text/answer', brief: 'Type hello.', answerRule: { type: 'exact', answer: 'hello' },
        referenceAnswer: 'hello', wrongAnswers: ['bye'] }],
    })
    for (const id of ['numeric-parts', 'cells']) lockTarget({ kind: 'package', id }, root)

    assert.deepEqual(readPackage('numeric-parts', root).levels, [])
    const content = readPackage('cells', root)
    const { lines } = await checkGame(content, { domain: await runtimeOf(content), authoring: true, root })
    assert.deepEqual(lines, [
      { level: 'cells/double', text: '1 runs' },
      { level: 'cells/double', text: 'cells/double', plugin: 'cells/levels' },
      { level: 'cells/prompt', fail: false, text: 'cells/prompt: text answers PASS', plugin: 'text/answers' },
      { level: 'cells/prompt', text: 'cells/prompt', plugin: 'cells/levels' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
