import { baselineValue } from './baseline-value.js'

export async function taskReports(spec, providers = []) {
  for (const provider of [...providers].sort((a, b) => (b.baselineReportPriority ?? 0) - (a.baselineReportPriority ?? 0))) {
    const records = provider.baselineReports?.({ spec, value: baselineValue })
    if (records) return records.map(baselineValue)
  }
  // A course with tasks but no observer cannot be recorded; the caller leaves it outside the corpus.
  return spec.levels.some(level => level.tasks.length) ? null : []
}
