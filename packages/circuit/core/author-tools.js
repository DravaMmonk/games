import { T as catalogText } from 'kernel/words'
import { partFlow } from './flow.js'
export const circuitTools = {
  flow: {
    about: catalogText("按课程顺序读取元件何时到手、临时发放、收起或取代，以及每个升级阶段运行的任务作品。各事件给出关卡、任务索引和源字段路径。"),
    params: { game: 'string', part: 'string', changeset: 'object?', scope: 'string?' },
    async run({ game, part, changeset = null, scope }, { contentAfter, runtimeOf }) {
      const content = await contentAfter(game, changeset, scope)
      if (content.packageTarget) return { events: [] }
      const domain = await runtimeOf(content)
      return { events: partFlow(domain.spec(content).course, content, part) }
    },
  },
}
