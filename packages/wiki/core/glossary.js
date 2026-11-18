import { T as catalogText } from 'kernel/words'
// Sections are authored objects; the glossary is their ordered display projection.

export function encyclopedia(entries, sections, resolve, ordered, local) {
  const groups = (ordered ?? Object.keys(sections).sort()).filter(id => sections[id]).map(id => ({
    id, title: sections[id].title, desc: sections[id].desc,
    values: sections[id].values.flatMap(value => resolve(value, 'entry', `sections/${id}`)),
  }))
  const selected = new Set(groups.flatMap(group => group.values))
  const grouped = entries.filter(entry => !ordered || selected.has(entry.id) || local(entry.id)).map(({ group: _group, ...entry }) => ({
    ...entry, group: groups.find(group => group.values.includes(entry.id))?.id ?? '',
  }))
  const ungrouped = grouped.filter(entry => !entry.group).map(entry => entry.id)
  if (ungrouped.length) groups.push({ id: '', title: catalogText("其它"), values: ungrouped })
  return { groups, entries: grouped }
}
