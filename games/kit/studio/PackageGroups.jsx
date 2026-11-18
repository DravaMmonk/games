import { useState } from 'react'
import { PACKAGE_KINDS } from '../engine/package-kinds.js'
import { L, tr } from '../shell/i18n.js'

const LABELS = {
  play: ['玩法包', 'Play packages'],
  ext: ['扩展包', 'Extensions'],
  course: ['课程包', 'Course packages'],
  lib: ['库包', 'Libraries'],
}

export const packageKindLabel = kind => tr(...LABELS[kind])

export function packageGroups(packages, filter = '') {
  return PACKAGE_KINDS.flatMap(kind => {
    if (filter && filter !== kind) return []
    const items = packages.filter(pkg => pkg.kind === kind)
    return items.length ? [{ kind, items }] : []
  })
}

const SOURCE_LABELS = {
  workspace: ['工作区', 'Workspace'],
  archive: ['发布归档', 'Release archive'],
  unknown: ['未知来源', 'Unknown source'],
}

export function packageSidebarGroups(packages, by) {
  if (by === 'source') return Object.entries(SOURCE_LABELS).map(([id, words]) => ({
    id, title: tr(...words),
    items: packages.filter(pkg => (Object.hasOwn(SOURCE_LABELS, pkg.source) ? pkg.source : 'unknown') === id),
  }))
  return [
    ...packageGroups(packages).map(({ kind, items }) => ({ id: kind, title: packageKindLabel(kind), items })),
    { id: 'unknown', title: tr('未分种类', 'No kind'), items: packages.filter(pkg => !PACKAGE_KINDS.includes(pkg.kind)) },
  ]
}

export function PackageKindFilter({ value, onChange, packages }) {
  return (
    <select className="studio-game package-kind-filter" aria-label={tr('包种类', 'Package kind')} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{tr('全部种类', 'All kinds')}</option>
      {packageGroups(packages).map(({ kind }) => <option key={kind} value={kind}>{packageKindLabel(kind)}</option>)}
    </select>
  )
}

export function PackageName({ info, range }) {
  return <span className="package-name" title={L(info.desc)}><span>{L(info.title)}</span><code>{info.id}{range && <> {range}</>}</code></span>
}

export function PackageDependencies({ packages }) {
  const [filter, setFilter] = useState('')
  return (
    <div className="package-dependencies">
      <PackageKindFilter value={filter} onChange={setFilter} packages={packages} />
      <dl>
        {packageGroups(packages, filter).map(({ kind, items }) => (
          <div key={kind}>
            <dt>{packageKindLabel(kind)}</dt>
            <dd>{items.map(info => <PackageName key={info.id} info={info} />)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
