import { qualifyItems, S, T as t } from 'kernel'

const args = (...names) => names.map(name => ({ name, type: 'kernel/any' }))

// These operations are tied to the evaluator's lazy branches and circuit register state.
export const BUILTINS = qualifyItems('circuit', {
  if: { about: t('条件为真取第二个，否则取第三个（只算取到的那一个）'), returns: 'kernel/any', params: S.obj({}), args: args('condition', 'yes', 'no'), run: ([c, y, n]) => (c ? y : n) },
  // A register, as a tick run keeps it (../ticks.js): its name scoped by the packed part the card is in.
  held: { about: t('寄存器 register 此刻存的值；还没存过时给 start'), args: [], returns: 'kernel/any', params: { type: 'obj', fields: { reg: { type: 'str', control: 'tree', default: 'A' }, start: { type: 'any', control: 'number', optional: true, default: null } } }, run: (_args, { reg: register, start }, ctx) => {
    // A register kept 「—」 holds 「—」: only one never kept gives its start.
    const held = ctx?.held?.(`${ctx.scope ?? ''}${register}`)
    return held === undefined ? start : held
  } },
})

export const BUILTIN_ITEMS = Object.fromEntries(
  Object.entries(BUILTINS).map(([name, { run: _run, ...item }]) => [name, item]),
)
