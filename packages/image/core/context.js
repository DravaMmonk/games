import { taskModule, runtimeWorks } from 'kernel'
import { imageWorks } from './work.js'
import runtime from './runtime.js'

const scopedWorks = new WeakMap()

export function imageContext({ content, task, progress }) {
  const imageOnly = content.levels.every(level => level.tasks.every(task => taskModule(task) === 'image'))
  if (!imageOnly && !scopedWorks.has(content)) scopedWorks.set(content, runtimeWorks(content, [{ id: 'image', runtime }]).works[0])
  const works = imageOnly ? imageWorks(content) : scopedWorks.get(content)
  if (progress) works.syncOwn(progress.built)
  const name = task.taskId ?? task.id
  const prepared = works.LEVELS.flatMap(level => level.tasks).find(task => task.taskId === name || task.key === name)
  if (!prepared) throw new Error(`unknown image task ${name}`)
  return { task: prepared, works }
}
