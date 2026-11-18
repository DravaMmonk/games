import { taskModule, runtimeWorks } from 'kernel'
import { logicWorks } from './work.js'
import runtime from './runtime.js'

const scopedWorks = new WeakMap()

export function logicContext({ content, task, progress }) {
  const onlyLogic = content.levels.every(level => level.tasks.every(task => taskModule(task) === 'logic'))
  if (!onlyLogic && !scopedWorks.has(content)) scopedWorks.set(content, runtimeWorks(content, [{ id: 'logic', runtime }]).works[0])
  const works = onlyLogic ? logicWorks(content) : scopedWorks.get(content)
  if (progress) works.syncOwn(progress.built)
  const name = task.taskId ?? task.id
  const prepared = works.LEVELS.flatMap(level => level.tasks).find(task => task.taskId === name || task.key === name)
  if (!prepared) throw new Error(`unknown logic task ${name}`)
  return { task: prepared, works }
}
