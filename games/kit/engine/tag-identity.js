// A tag identity includes its member type. References retain their authored full name.
export const tagKey = (member, name) => `${member}:${name}`
export const tagName = key => key.slice(key.indexOf(':') + 1)
export const LEVEL_MARKS = { optional: 'kernel/optional', skippable: 'kernel/skippable' }
export const kernelTags = new Map([
  ['kind', 'kernel/studio-left'],
  ...Object.values(LEVEL_MARKS).map(name => ['level', name]),
].map(([member, name]) => [tagKey(member, name), { member, name, reader: 'kernel' }]))
