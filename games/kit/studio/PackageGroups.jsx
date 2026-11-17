import { useState } from 'react'
import { PACKAGE_KINDS } from '../engine/package-kinds.js'
import { tr } from '../shell/i18n.js'

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

export function PackageKindFilter({ value, onChange, packages }) {
  return (
    <select className="studio-game package-kind-filter" aria-label={tr('包种类', 'Package kind')} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{tr('全部种类', 'All kinds')}</option>
      {packageGroups(packages).map(({ kind }) => <option key={kind} value={kind}>{packageKindLabel(kind)}</option>)}
    </select>
  )
}

export function PackagePicker({ packages, current, disabled, label, onChange, packageValue = id => id, children }) {
  const [filter, setFilter] = useState('')
  const groups = packageGroups(packages, filter)
  const shown = groups.some(({ items }) => items.some(({ id }) => packageValue(id) === current))
  const selected = shown || (children && current.startsWith('game:')) ? current : ''
  return (
    <div className="studio-package-picker">
      <PackageKindFilter value={filter} onChange={setFilter} packages={packages} />
      <select className="studio-game" value={selected} disabled={disabled} aria-label={label} onChange={event => onChange(event.target.value)}>
        {!selected && <option value="" disabled>{tr('选择包', 'Choose a package')}</option>}
        {groups.map(({ kind, items }) => (
          <optgroup key={kind} label={packageKindLabel(kind)}>
            {items.map(({ id }) => <option key={id} value={packageValue(id)}>{id}</option>)}
          </optgroup>
        ))}
        {children}
      </select>
    </div>
  )
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
            <dd>{items.map(({ id }) => <code key={id}>{id}</code>)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
