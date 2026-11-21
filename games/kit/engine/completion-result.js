// Completion values are serializable measurements from one judged attempt.
export function completionResult(values) {
  if (values == null) return null
  if (typeof values !== 'object' || Array.isArray(values)) {
    throw new TypeError('Completion results require a map of measurements')
  }
  const entries = Object.entries(values)
  if (!entries.length) return null
  if (entries.some(([metric, value]) => !/^[a-z][a-z0-9_]*$/.test(metric) || !Number.isFinite(value))) {
    throw new TypeError('Completion results require named, finite numeric values')
  }
  return { values: Object.fromEntries(entries) }
}
