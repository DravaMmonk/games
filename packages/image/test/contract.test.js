import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { runtimeFromPlugins } from '../../../games/kit/engine/runtime.js'
import { readPackage } from '../../../games/kit/engine/resolver.js'
import { packageLevel } from '../../../games/kit/engine/package-play.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { testProject } from '../../../games/kit/engine/test-fixture.js'
import { installImageFixture } from '../../qed/test/fixture.js'

const copy = {
  title: 'Copy', intro: [], after: 'Every pixel is preserved.',
  tasks: [{ id: 'copy', play: 'image/graph', brief: 'Connect the image to the output.', scene: 'image/filter', setup: { target: 'image/same' },
    tests: [{ label: 'Square', in: 'image/square' }], hidden: [{ label: 'Disk', in: 'image/disk' }],
    solution: ['out <- in'], naive: ['a = image/shift[dir=right](in)', 'out <- a'],
  }],
}
let project, content
before(() => {
  project = testProject('image-contract-')
  installImageFixture(project.root)
  project.put('packages/sample/package.json', { kind: 'lib', version: '0.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', image: '^0.0.0' } })
  project.put('packages/sample/levels/copy.json', copy)
  lockTarget({ kind: 'package', id: 'sample' }, project.root)
  content = packageLevel(readPackage('sample', project.root), 'sample/copy')
})
after(() => { if (project) rmSync(project.root, { recursive: true, force: true }) })

test('the standalone image graph validates, round-trips and accepts a textual answer', async () => {
  const kernel = await loadPlugins(content, project.root)
  const runtime = runtimeFromPlugins(content, kernel)
  const lines = await runtime.validate(runtime.spec(content))
  assert.deepEqual(lines, [
    { level: 'sample/copy', text: 'sample/copy hidden: solution PASS  Disk:✓0' },
    { level: 'sample/copy', text: 'sample/copy Copy: solution PASS [n=0 c=0]  Square:✓0/0.000' },
    { level: 'sample/copy', text: '  naive fails  Square:✗32/0.800' },
  ])
  const task = content.levels[0].tasks[0]
  const context = { content, task }
  const good = evaluatePlay(kernel, task, task.solution, context)
  assert.equal(good.verdict.pass, true)
  const graph = kernel.tables.play.get(task.play)
  assert.deepEqual(graph.read(graph.write(good.work), context), good.work)
  const agent = kernel.tables.agent.get(task.play)
  assert.equal(agent.observe(context).kind, 'circuit')
  assert.equal(agent.act(context, task.solution.join('\n')).pass, true)
  assert.equal(agent.act(context, task.naive.join('\n')).pass, false)
})

test('a value view can be opened by only one level', () => {
  const first = { ...copy, opensViews: ['image/profile'] }
  const second = { ...first, tasks: copy.tasks.map(task => ({ ...task, id: 'other' })) }
  project.put('packages/sample/levels/copy.json', first)
  assert.deepEqual(readPackage('sample', project.root).objectProblems, [])
  project.put('packages/sample/levels/other.json', second)
  assert.ok(readPackage('sample', project.root).objectProblems.some(problem =>
    problem.at === 'levels/sample/other.opensViews' && /image\/profile is already opened by sample\/copy/.test(problem.says)))
})
