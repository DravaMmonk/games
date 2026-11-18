import { registeredOperations } from 'kernel'
import { OperationError, qualifyItems, S } from "kernel"
import { T as t } from 'kernel/words'

const args = (...names) => names.map(name => ({ name, type: 'kernel/any' }))
const nums = (...names) => names.map(name => ({ name, type: 'kernel/number' }))

function number(value, coerce = false) {
  const n = coerce ? Number(value) : value
  if (!Number.isFinite(n)) throw new OperationError(t("{value} 不是数", {value}))
  return n
}

const num = value => number(value, true)

export const operations = qualifyItems('numlib', {
  add: { about: 'a + b', args: nums('a', 'b'), returns: 'kernel/number', params: S.obj({}), symmetric: true, run: ([a, b]) => number(a) + number(b) },
  sub: { about: 'a − b', args: nums('a', 'b'), returns: 'kernel/number', params: S.obj({}), run: ([a, b]) => number(a) - number(b) },
  constant: { about: t("设置中的常量"), args: [], returns: 'kernel/number', params: { type: 'obj', fields: { value: { type: 'num', default: 0 } } }, run: (_args, { value }) => value },
  zero: { args: [], returns: 'kernel/number', run: () => 0 },
  lt: { about: 'a < b', args: nums('a', 'b'), returns: 'kernel/boolean', run: ([a, b]) => num(a) < num(b) },
  le: { about: 'a ≤ b', args: nums('a', 'b'), returns: 'kernel/boolean', run: ([a, b]) => num(a) <= num(b) },
  gt: { about: 'a > b', args: nums('a', 'b'), returns: 'kernel/boolean', run: ([a, b]) => num(a) > num(b) },
  ge: { about: 'a ≥ b', args: nums('a', 'b'), returns: 'kernel/boolean', run: ([a, b]) => num(a) >= num(b) },
  plus: { about: t('两数之和'), args: nums('a', 'b'), returns: 'kernel/number', run: ([a, b]) => num(a) + num(b) },
  minus: { about: t('两数之差'), args: nums('a', 'b'), returns: 'kernel/number', run: ([a, b]) => num(a) - num(b) },
  times: { about: t('两数之积'), args: nums('a', 'b'), returns: 'kernel/number', run: ([a, b]) => num(a) * num(b) },
  over: { about: t('两数之商；除以 0 报错'), args: nums('a', 'b'), returns: 'kernel/number', run: ([a, b]) => {
    const divisor = num(b)
    if (divisor === 0) throw new OperationError(t('除以 0'))
    return num(a) / divisor
  } },
  round: { about: t('按 digits 位小数四舍五入'), args: nums('a'), returns: 'kernel/number', params: { type: 'obj', fields: { digits: { type: 'int', min: 0, max: 8, optional: true, default: 0 } } }, run: ([a], { digits = 0 }) => Number(num(a).toFixed(digits)) },
  clamp: { about: t('限制在 lo 到 hi 之间'), args: nums('a', 'lo', 'hi'), returns: 'kernel/number', run: ([a, lo, hi]) => Math.min(num(hi), Math.max(num(lo), num(a))) },
  eq: { returns: 'kernel/boolean', args: args('a', 'b'), run: ([a, b]) => String(a) === String(b) },
  ne: { returns: 'kernel/boolean', args: args('a', 'b'), run: ([a, b]) => String(a) !== String(b) },
  and: { returns: 'kernel/boolean', args: args('a', 'b'), run: ([a, b]) => Boolean(a) && Boolean(b) },
  or: { returns: 'kernel/boolean', args: args('a', 'b'), run: ([a, b]) => Boolean(a) || Boolean(b) },
  not: { returns: 'kernel/boolean', args: args('a'), run: ([a]) => !a },
})

for (const operation of Object.values(operations)) operation.params ??= S.obj({})

export function register(kernel) {
  Object.assign(registeredOperations, operations)
  for (const [name, { run, ...signature }] of Object.entries(operations)) {
    kernel.capability('operation', name, signature)
    kernel.implement('operation', name, { run })
  }
}
