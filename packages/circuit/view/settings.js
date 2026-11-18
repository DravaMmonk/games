import { T as catalogText } from 'kernel/words'
const staged = game => [...(game.circuit?.played?.values() ?? [])].some(tasks => tasks.some(task => task.carry || task.carries))
export const circuitSettings = [
  { key: 'manualBlocks', group: 'edit', label: catalogText("手动分区"), kind: 'toggle', default: false, when: (game, { phone = false } = {}) => phone && staged(game) },
  { key: 'connectionLabels', group: 'display', label: catalogText("跨段连线画成标签"), kind: 'toggle', default: (_game, { phone = false } = {}) => phone, when: staged },
]
