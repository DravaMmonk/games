// Trays describe presentation: ordered parts and optional menus for related parts.
import { S } from 'kernel'



export const trayMembers = (tray) => (tray?.items ?? []).flatMap((entry) => typeof entry === 'string' ? [entry] : entry.items)


/** How many entries the shown tray may hold before its menus gather parts: a tray's `menuThreshold`, else this. */
export const MENU_THRESHOLD = 7

// The menu each part belongs to: the selected trays' own menus, and for a variant with a traySource its original
// part's menu, in whichever tray declares it.
function menusOf(trays, names, items, partOf) {
  const menusIn = (name) => (trays[name]?.items ?? []).filter((entry) => typeof entry !== 'string')
    .map((entry) => ({ ...entry, items: entry.items.map(partOf), key: JSON.stringify([name, entry.id]) }))
  const menus = names.flatMap(menusIn)
  const menuOf = new Map()
  for (const menu of menus) for (const type of menu.items) if (!menuOf.has(type)) menuOf.set(type, menu)
  const sourceMenus = new Map(menuOf)
  if (items.some(({ traySource }) => traySource)) {
    const otherMenus = Object.keys(trays).filter((name) => !names.includes(name)).flatMap(menusIn)
    for (const menu of otherMenus) for (const type of menu.items) if (!sourceMenus.has(type)) sourceMenus.set(type, menu)
  }
  const assignedMenu = ({ traySource }) => traySource ? sourceMenus.get(partOf(traySource)) : undefined
  for (const item of items) {
    const menu = assignedMenu(item)
    if (menu) menuOf.set(item.type, menu)
  }
  return { menus, menuOf, assignedMenu }
}

/**
 * Parts gathered by the menu each belongs to, whatever their number, for a panel that lays a tray out in full:
 * [{ key, label, items }] in the order the parts come, the parts no menu holds together under no label.
 */
export function trayGroups(trays, names, items, partOf = id => id) {
  const { menuOf } = menusOf(trays, names, items, partOf)
  const groups = new Map()
  for (const item of items) {
    const menu = menuOf.get(item.type)
    if (!groups.has(menu)) groups.set(menu, { key: menu?.key ?? '', label: menu?.title ?? null, items: [] })
    groups.get(menu).items.push(item)
  }
  return [...groups.values()]
}

/**
 * Project available parts onto the selected trays, leaving availability to the course.
 *
 * Shown parts: while the tray would hold at least `menuThreshold` entries (7 by default; the least the selected trays
 * set), the menu holding the most of them gathers them into one entry (on ties, the first in the tray), then the next,
 * until the entries — menus and parts on their own — are fewer, or nothing gathers any more: the menus alone reach
 * the threshold, or no menu holds two of the parts still on their own. A menu gathered holds its folded parts too.
 * A variant with a traySource inherits its original part's menu. Selected trays take priority when the original is
 * in more than one menu.
 *
 * Folded parts: every one in a menu goes into it (one entry for each menu); the rest stand on their own.
 */
export function trayDisplay(trays, names, shown, folded, partOf = id => id) {
  const set = names.map((name) => trays[name]?.menuThreshold).filter(Number.isInteger)
  const threshold = set.length ? Math.min(...set) : MENU_THRESHOLD
  const items = new Map([...shown, ...folded].map((item) => [item.type, item]))
  const visible = [...new Map(shown.map((item) => [item.type, item])).values()]
  const { menus, menuOf, assignedMenu } = menusOf(trays, names, [...items.values()], partOf)
  const groupingMenus = [...new Set([...menus, ...visible.map(assignedMenu).filter(Boolean)])]
  const members = (menu, of) => of.filter(({ type }) => menuOf.get(type) === menu)
  const childrenOf = (menu) => {
    const ordered = [
      ...visible.filter((item) => assignedMenu(item) === menu).map(({ type }) => type),
      ...menu.items,
      ...folded.filter((item) => assignedMenu(item) === menu).map(({ type }) => type),
    ]
    return [...new Set(ordered)].flatMap((type) => menuOf.get(type) === menu && items.has(type) ? [items.get(type)] : [])
  }
  const entry = (menu, children) => ({ menu: menu.key, label: menu.title, children })

  // Gather the shown parts, the fullest menu first, while the tray holds too many entries.
  const gathered = new Set()
  let count = visible.length
  while (count >= threshold && gathered.size < threshold) {
    const next = groupingMenus.filter((menu) => !gathered.has(menu)).map((menu) => [menu, members(menu, visible).length])
      .reduce((best, candidate) => (candidate[1] > (best?.[1] ?? 1) ? candidate : best), null)
    if (!next) break
    gathered.add(next[0])
    count -= next[1] - 1
  }
  const out = []
  const placed = new Set()
  for (const item of visible) {
    const menu = menuOf.get(item.type)
    if (!gathered.has(menu)) out.push(item)
    else if (!placed.has(menu)) {
      placed.add(menu)
      out.push(entry(menu, childrenOf(menu)))
    }
  }

  // Every folded part in a menu goes into it, unless that menu is already gathered among the shown ones.
  const more = []
  const foldedMenus = new Set()
  const shownTypes = new Set(visible.map(({ type }) => type))
  for (const item of folded) {
    if (shownTypes.has(item.type)) continue
    const menu = menuOf.get(item.type)
    if (!menu) more.push(item)
    else if (!gathered.has(menu) && !foldedMenus.has(menu)) {
      foldedMenus.add(menu)
      more.push(entry(menu, childrenOf(menu).filter(({ type }) => !shownTypes.has(type))))
    }
  }
  return { items: out, folded: more }
}

/** A task names a declared tray; membership is resolved by the content assembler. */
export const TRAY = S.opt(S.name('circuit/tray'))

/** The names of the parts a game's levels build, for its trays (domain.js names; the vocabulary's go by reference). */
export const partNames = (built = []) => ({ 'circuit/part': new Set(built) })

/** The tray a level or task plays with: the one it names, else a game's only tray; null in a game of several. */
export const trayIn = (trays = {}, named) => named ?? (Object.keys(trays).length === 1 ? Object.keys(trays)[0] : null)
