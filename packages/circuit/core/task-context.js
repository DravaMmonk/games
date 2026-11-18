import { runtimeWorks, taskModule } from 'kernel'

/** Resolve a circuit extension's task and sync its published boards from the current save. */
export function createTaskContext(id, runtime, readWorks) {
  const scopedWorks = new WeakMap()
  return ({ content, task, progress }) => {
    const ownContent = content.levels.every(level => level.tasks.every(item => taskModule(item) === id))
    if (!ownContent && !scopedWorks.has(content)) {
      scopedWorks.set(content, runtimeWorks(content, [{ id, runtime }]).works[0])
    }
    const works = ownContent ? readWorks(content) : scopedWorks.get(content)
    if (progress) works.syncOwn(progress.built)
    const name = task.taskId ?? task.id
    const prepared = works.LEVELS.flatMap(level => level.tasks).find(item => item.taskId === name || item.key === name)
    if (!prepared) throw new Error(`unknown ${id} task ${name}`)
    return { task: prepared, works }
  }
}
