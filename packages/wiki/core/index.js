import { S, assertStableIds, mergePatch, refsIn, sideOf } from "kernel"
import { T } from 'kernel/words'
import { encyclopedia } from './glossary.js'
import { GLOSSARY } from './schema.js'
import { termRegistry, termUsage } from './terminology.js'

const REFERENCE = 'wiki'
const orderedEntries = registries => Object.keys(registries.entry).sort().map(id => ({ id, ...registries.entry[id] }))

function blindText(game) {
  const entries = new Map(game.glossary.entries.map(entry => [entry.id, entry]))
  return {
    name(kind, id, lang) {
      return kind === REFERENCE && sideOf(entries.get(id)?.title, lang)
    },
    linked({ texts, level, solved, lang, say }) {
      const open = refsIn(texts, REFERENCE).map(id => entries.get(id)).filter(entry => entry &&
        (!entry.at || (game.byId[entry.at] && (entry.at === level.id || game.isOpen(game.byId[entry.at], solved)))))
      return open.length ? [`## ${lang === 'en' ? 'Encyclopedia (linked above)' : '百科（上文链接的词条）'}\n${open.map(entry => `- ${say(entry.title)}: ${say(entry.body)}`).join('\n')}`] : []
    },
  }
}

export function register(kernel) {
  kernel.reference(REFERENCE, { target: 'entry', label: 'encyclopedia entry', scoped: true })
  kernel.kind('wiki/entries', {
    type: 'entry',
    selector: 'entry',
    read: value => value,
    derived: ['glossary', 'sections'],
    studio: { schemas: { glossary: GLOSSARY } },
    terminology: { termRegistry, termUsage },
    blindText,
    assemble({ game, id, packageId, registries, resolve }) {
      const local = entry => entry.startsWith(`${packageId}/`) || entry.startsWith(`@${id}/`)
      return { glossary: encyclopedia(orderedEntries(registries), registries.section, resolve, game.encyclopedia, local), sections: registries.section }
    },
    texts({ content, spec }) {
      const entries = content.glossary.entries
      if (!spec) return { entries }
      const placed = new Set(spec.levels.map(level => level.id))
      return { glossary: entries.map(entry => !entry.at || placed.has(entry.at) ? entry : {}) }
    },
    contentChecks: ({ content }) => termRegistry(content.glossary).failures.map(finding => ({
      fail: true, text: `terminology ${finding.rule} ${finding.at}: ${finding.says}`,
    })),
    operations: {
      'entry.patch': {
        about: T('按 JSON merge patch 改一条百科的几个字段'),
        params: S.obj({ entry: S.str({ pattern: "^[A-Za-z0-9][A-Za-z0-9-]*$" }), fields: S.map(S.any()) }),
        apply(ws, { entry, fields }) {
          const entries = ws.contentObjects.entry
          const old = entries.get(entry)
          if (!old) throw new Error(`no entry ${entry}`)
          const next = mergePatch(old, fields)
          assertStableIds(old, next)
          entries.set(entry, next)
          return { says: `entry ${entry}: patched`, inverse: [{ op: 'entry.put', entry, data: old }] }
        },
      },
    },
  })
  kernel.kind('wiki/sections', {
    type: 'section', selector: 'section', read: value => value, textPrefix: 'sections',
    studio: { collections: { section: { accepts: kind => kind === 'entry', types: () => ['entry'], members: section => section.values } } },
  })
  const check = ({ content, levelLinks, opensBy, linked, placed }) => {
    const { entries } = content.glossary
    const byId = new Map(entries.map(entry => [entry.id, entry]))
    const out = []
    const inspect = (title, at, links) => {
      for (const id of new Set(links)) {
        const target = byId.get(id)
        if (!target) out.push({ fail: true, text: `${title} links the entry ${id}, which is missing from this game's encyclopedia` })
        else if (!opensBy(target.at, at)) out.push({ fail: true, text: `${title} links the entry ${id}, which opens later (at ${target.at})` })
      }
    }
    for (const [id, links] of levelLinks(REFERENCE)) inspect(id, id, links)
    for (const entry of entries) {
      if (!entry.at || placed.has(entry.at)) inspect(`entry ${entry.id}`, entry.at, linked(GLOSSARY.fields.entries.of, entry, REFERENCE))
      for (const id of entry.see ?? []) if (!byId.has(id)) out.push({ fail: true, text: `entry ${entry.id} has related entry ${id}, which is missing from this game's encyclopedia` })
    }
    return out
  }
  check.phase = 'references'
  kernel.check('wiki/references', check)
}
