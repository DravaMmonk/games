import { useSetting } from 'kernel/view'
import { T } from 'kernel/words'

const symbolic = (test) => test.symbolic

export const generalFormSetting = {
  key: 'generalFormFirst',
  group: 'display',
  label: T('一般形式优先'),
  tip: T('有一般形式页签时，将其排在首位并默认选中。证明器的案例直接用符号显示。'),
  kind: 'toggle',
  default: false,
  when: (game) => game.levels.some((level) => level.tasks.some(({ kind, source }) =>
    (kind === 'logic/machine' && source.tests?.length > 0) || source.tests?.some(symbolic) || source.views?.some(symbolic))),
}

export const useGeneralForm = () => useSetting(generalFormSetting.key)[0]

export function usePreferredTest(tests = []) {
  if (!useGeneralForm()) return undefined
  const index = tests.findIndex(symbolic)
  return index < 0 ? undefined : index
}
