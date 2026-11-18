const formatReason = Symbol('formatReason')

/** Attach a live formatter without changing the structured failure data sent to tools. */
export function failureReason(data, format) {
  return { ...data, [formatReason]: format }
}

/** What a case reports before a final note is shown. */
export const reportedFailure = run => run.error ?? (run.final ? null : failureText(run.fail))

export function failureText(failure) {
  if (!failure) return null
  const { why } = failure
  return why?.[formatReason] ? why[formatReason](failure) : why
}
