// Prepared tasks retain the resolved world when copied for a run. The symbol keeps it out of work and content JSON.
const taskWorld = Symbol('table world')
export const withWorld = (task, world) => ({ ...task, [taskWorld]: world })
export const worldOf = task => task[taskWorld]
