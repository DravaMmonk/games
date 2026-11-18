import { BookMarked } from 'lucide-react'
import { L } from "kernel/view"
import { T, tr } from 'kernel/words'
import Encyclopedia, { glossaryLayout, openedEntries, useWiki } from './Encyclopedia.jsx'

import { EntryList, groupings } from './EntryList.jsx'
import { SectionEditor } from './SectionEditor.jsx'

const PANEL = 'wiki/wiki'

function useEncyclopedia({ game, progress, solved, level, phone, setSheet, authoring }) {
  const wiki = useWiki(game, progress, solved, level)
  const unread = wiki.unread.length
  const open = () => setSheet(PANEL)
  return {
    mapActions: <button className="kit-btn is-label wiki-button" aria-label={tr('百科')} onClick={open}><BookMarked size={15} /><span>{tr('百科')}</span>{unread > 0 && <b>{tr("新增 {unread} 条", {unread})}</b>}</button>,
    levelActions: <button className="kit-btn is-label bar-button wiki-button" onClick={open} aria-label={tr("百科{value}", {value: { zh: String(unread ? `（${unread} 条未读）` : ''), en: String(unread ? ` (${unread} unread)` : '') }})}>
      <BookMarked size={16} /><span>{tr('百科')}</span>{unread > 0 && <i className="wiki-dot" />}
    </button>,
    reference(kind, id) {
      if (kind !== 'wiki') return null
      const entry = wiki.entries.find(item => item.id === id)
      return entry && { title: L(entry.title), open: wiki.isOpen(entry), at: game.byId[entry.at], panel: PANEL }
    },
    panel({ sheet, start, close }) {
      return sheet === PANEL && <Encyclopedia game={game} wiki={wiki} level={level} phone={phone} start={start} edit={authoring} onClose={close} />
    },
  }
}

export function register(kernel) {
  kernel.editor('wiki/entry', { type: 'entry', listKey: 'entries', component: EntryList, sidebar: EntryList, name: T('词条', {}, 'studio-editor'), groupings })
  kernel.editor('wiki/section', { type: 'section', component: SectionEditor, group: { listType: 'entry', name: T('百科分组', {}, 'studio-editor'), createLabel: T('新的分组', {}, 'studio-editor'), initial: () => ({ title: T("新的分组"), values: [] }) } })
  kernel.shell('wiki/wiki', useEncyclopedia)
  kernel.unlocks('wiki/entries', (game, level, before, after) =>
    openedEntries(game, glossaryLayout(game).entries, level, before, after).map(entry => ({ key: entry.id, kind: 'entry', order: 1, icon: BookMarked, label: entry.title })))
  kernel.display('wiki/wiki-link', {
    reference: 'wiki',
    icon: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m10 2 0 7 2.5-2 2.5 2V2"/></svg>',
    action: name => tr("在百科里看 {name}", {name}),
  })
}
