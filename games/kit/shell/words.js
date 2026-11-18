// The words every game's screens use for the same things (games/design/README.md 6.9): a domain takes these and coins no
// other.
import { T } from './i18n.js'

export const WORDS = {
  result: T("结果", {}, "words"),
  wanted: T("目标"),
  // The run key: a board run step by step is run, one checked at once is checked; once passed, it says so.
  run: T('运行'),
  check: T('检查'),
  passed: T("通过"),
  sample: T('样张'),
  conclusion: T("结论"),
  test: (k) => T("测试 {k}", {k: k + 1}),
}
