export const type = 'progress/policy'
export const excluded = new Set(['kind', 'shape', 'tag', 'relation', 'game', type])

export function policyFor(content, kind, target) {
  const policies = Object.values(content?.registries?.[type] ?? {})
    .filter(policy => policy.kind === kind && (!target || !policy.targets || policy.targets.includes(target)))
  return {
    stages: policies.some(policy => policy.stages),
    grants: policies.some(policy => policy.grants),
    unlocks: policies.some(policy => policy.unlocks),
    checks: new Set(policies.flatMap(policy => policy.checks ?? [])),
  }
}

export const objectsOf = content => ({
  ...content.registries,
  level: Object.fromEntries((content.levels ?? []).map(level => [level.id, level])),
  task: Object.fromEntries((content.levels ?? []).flatMap(level => (level.tasks ?? []).map(task => [task.id, task]))),
})

export function grantScope(policies, enabled = policy => policy.grants) {
  const byOwner = new Map()
  for (const [id, policy] of policies) if (enabled(policy)) {
    const owner = id.split('/')[0]
    const kinds = byOwner.get(owner) ?? new Set()
    kinds.add(policy.kind)
    byOwner.set(owner, kinds)
  }
  const all = [...new Set([...byOwner.values()].flatMap(kinds => [...kinds]))]
  return id => byOwner.has(id.split('/')[0]) ? [...byOwner.get(id.split('/')[0])] : all
}
