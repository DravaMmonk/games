import { partFlow } from './flow.js'
export const circuitTools = {
  flow: {
    about: { zh: '按课程顺序读取元件何时到手、临时发放、收起或取代，以及每个升级阶段运行的任务作品。各事件给出关卡、任务索引和源字段路径。', en: 'A part’s way through a game’s course (as a changeset would leave it), read off the course, in course order: where it is at hand from the start, where a level brings it in, where a level or one of its tasks gives it there only or withholds it, where a part superseding it arrives, and each step of its upgrade chains (the task whose work runs inside it, with its form). Each event names the level, the task (an index) and the path of the field in the level’s content that says it (null: none).' },
    params: { game: 'string', part: 'string', changeset: 'object?', scope: 'string?' },
    async run({ game, part, changeset = null, scope }, { contentAfter, runtimeOf }) {
      const content = await contentAfter(game, changeset, scope)
      if (content.packageTarget) return { events: [] }
      const domain = await runtimeOf(content)
      return { events: partFlow(domain.spec(content).course, content, part) }
    },
  },
}
