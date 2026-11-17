const unique = items => [...new Set(items)]

export function grantingFields(content, { level, tasks, task, local, additions, grants, withheld, opened }) {
  const defaultAdds = (at) => unique([...(level(at).adds ?? []), ...tasks(at)
    .slice(0, at.task === undefined ? undefined : at.task + 1).flatMap((task) => task.adds ?? [])])
  const adds = (at) => additions?.(at) ?? defaultAdds(at)
  const localAt = (part, at) => local.includes(part) || (level(at).local ?? []).includes(part)
    || tasks(at).some((task, index) => (at.task === undefined || index === at.task) && (task.local ?? []).includes(part))
  const isLocal = (part, at) => at ? localAt(part, at) : local.includes(part)
    || content.levels.some((level) => localAt(part, level))
      && !content.levels.some((level) => defaultAdds(level).includes(part) && !localAt(part, level))

  return {
    adds, local: isLocal,
    awards: (at) => [...(at.task === undefined || at.task >= tasks(at).length ? level(at).awards ?? [] : []), ...tasks(at).flatMap((task, index) => at.task === undefined || index < at.task ? task.awards ?? [] : [])],
    gives: (at) => unique([...(level(at).gives ?? []), ...(task(at)?.gives ?? []), ...grants(at)]),
    withholds: (at) => unique([...(task(at)?.withholds ?? level(at).withholds ?? []), ...(task(at)?.without ?? level(at).without ?? []), ...withheld(at)]),
    opens: (at) => unique([...(level(at).opens ?? []), ...tasks(at)
      .flatMap((task, index) => at.task === undefined || index <= at.task ? task.opens ?? [] : []), ...opened(at)]),
  }
}
