import { useMemo } from 'react'
import { useSetting } from 'kernel/view'
import { T } from 'kernel/words'

// A player's choice for rule-bound machine cards left with several rules or several rewrite matches and none picked:
// off, the card waits to be set; on, it takes the first rule and the first match. Reference boards and content checks
// never read it.
export const autoFirstSetting = {
  key: 'autoFirstChoice',
  group: 'edit',
  label: T('未选时用第一项'),
  tip: T('元件有多条规则或多处可改写位置而没有选定时，自动采用第一条规则和第一处位置。'),
  kind: 'toggle',
  default: false,
  when: (game) => game.levels.some((level) => level.tasks.some(({ kind, source }) => kind === 'logic/machine' && source.directRuleCards)),
}

/** The options a machine board is run and previewed with, the same object while the setting stands. */
export function useMachineRunOptions() {
  const [autoFirst] = useSetting(autoFirstSetting.key)
  return useMemo(() => ({ autoFirst }), [autoFirst])
}
