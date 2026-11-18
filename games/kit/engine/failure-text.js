import { T, sideOf } from '../shell/i18n.js'

/** What a case reports before a final note is shown. */
export const reportedFailure = (run) => run.error ?? (run.final ? null : failureText(run.fail))

/** Format the first failure, with its values when the relation gives them meaning. */
export function failureText(failure) {
  if (!failure) return null
  const { why, want, got, at } = failure
  if (why?.relation === 'evaluates') return T("{value} 应当算出 {value2}，现在算出 {value3}", {value: { zh: String(sideOf(why.subject, 'zh')), en: String(sideOf(why.subject, 'en')) }, value2: { zh: String(sideOf(why.show(want), 'zh')), en: String(sideOf(why.show(want), 'en')) }, value3: { zh: String(sideOf(why.show(got), 'zh')), en: String(sideOf(why.show(got), 'en')) }})
  if (why?.relation === 'derives') {
    const { given, subject } = why
    const start = given.en.charAt(0).toUpperCase() + given.en.slice(1)
    return want
      ? T("{zh}时，「{zh2}」应当可推导，这份声明却推导不出。", {zh: { zh: String(given.zh), en: String(start) }, zh2: { zh: String(subject.zh), en: String(subject.en) }})
      : T("{zh}时，「{zh2}」不应当可推导，这份声明却推导出了它。", {zh: { zh: String(given.zh), en: String(start) }, zh2: { zh: String(subject.zh), en: String(subject.en) }})
  }
  if (why?.relation === 'order') return T("「{value}」：{zh}应当是 {value2}，这块板给出 {value3}。", {value: { zh: String(sideOf(why.subject, 'zh')), en: String(sideOf(why.subject, 'en')) }, zh: { zh: String(why.words.zh), en: String(why.words.en) }, value2: { zh: String(why.show(want, 'zh')), en: String(why.show(want, 'en')) }, value3: { zh: String(why.show(got, 'zh')), en: String(why.show(got, 'en')) }})
  if (why?.relation === 'output') {
    const given = why.show(want)
    const actual = why.show(got)
    const sentence = T('「{subject}」应当是 {want}，这块板给出 {got}。', { subject: why.subject, want: given, got: actual })
    return at?.tick === undefined ? sentence : T("第 {tick} 拍，{zh}", { tick: at.tick, zh: sentence })
  }
  return why
}
