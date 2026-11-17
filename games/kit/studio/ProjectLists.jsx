// What the studio's workspaces open, listed in their left columns (games/DESIGN.md 6.7): the packages (Build, Copy)
// and the games (Arrange, Copy), each its own list with a search. A click picks one, its meta goes in the middle
// (PackageMeta, GameMeta, read only) and its file in the right column (package.json, game.json: JsonFile, or the
// open game's in the Inspector, where it is edited); a double click, Enter, or the meta's Open opens it, the workspace's pending
// operations given up after asking. A list may make a new one (`making`): a package empty or copied from the one
// picked, a game on the picked game's package.
import { Fragment, useState } from 'react'
import { Gamepad2, Package } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import SidebarListTools from './SidebarListTools.jsx'

const ID = /^[a-z][a-z0-9-]*$/

/** The words a search looks in: an id, its titles in every language, and what it uses. */
const words = (...parts) => parts.flat().filter(Boolean).map((part) => (typeof part === 'object' ? Object.values(part).join(' ') : String(part))).join(' ').toLowerCase()
const found = (query, text) => !query.trim() || query.trim().toLowerCase().split(/\s+/).every((word) => text.includes(word))

/** A row of a project list, as every left list draws one (ListRow.jsx): its icon, its name, the id at the right end;
 *  the one open marked, the one picked lit. */
function Row({ id, icon: Icon, open, picked, disabled, title, name, children, onPick, onOpen }) {
  return (
    <button type="button" className={`parts-row project-pick ${picked ? 'is-on' : ''} ${open ? 'is-open' : ''}`} aria-current={open ? 'true' : undefined} aria-pressed={picked}
      onClick={() => onPick(id)} onDoubleClick={() => !disabled && onOpen(id)}
      onKeyDown={(event) => { if (event.key === 'Enter' && !disabled) { event.preventDefault(); onOpen(id) } }}
      title={`${title}${open ? '' : ` — ${tr('双击打开', 'double-click to open')}`}`}>
      <i className="family-chip"><Icon size={12} aria-hidden="true" /></i>
      <span>{name}</span>
      {children}
      {open && <b className="project-pick-open">{tr('打开中', 'Open')}</b>}
    </button>
  )
}

/** The form a new package or game is named in, at the top of its list. `fields`: [key, placeholder]. */
function NewForm({ heading, fields, problem, onMake, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key, ''])))
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try { await onMake(values) } finally { setBusy(false) }
  }
  return (
    <form className="project-new" onSubmit={submit}>
      <strong>{heading}</strong>
      {fields.map(([key, placeholder], k) => (
        <input key={key} className="field-input" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder={placeholder} aria-label={placeholder}
          autoFocus={k === 0} spellCheck={false} disabled={busy} />
      ))}
      {problem && <small className="is-error" role="status">{problem}</small>}
      <span className="project-new-actions">
        <button type="submit" className="kit-btn is-label is-solid" disabled={busy}>{busy ? tr('建立中……', 'Making…') : tr('建立', 'Make')}</button>
        <button type="button" className="kit-btn is-label" disabled={busy} onClick={onCancel}>{tr('取消', 'Cancel')}</button>
      </span>
    </form>
  )
}

/**
 * The packages: `current` the one open, `picked` the one whose meta shows; `onCreate({ id, from?, empty? })`, when
 * given, makes a new one (resolving when it is made, throwing its refusal).
 */
export function PackageList({ packages, current, picked, disabled, onPick, onOpen, onCreate = null }) {
  const [query, setQuery] = useState('')
  const [making, setMaking] = useState(null) // { from } or { empty: true }, and the last refusal
  const listed = [...packages].sort((a, b) => a.id.localeCompare(b.id)).filter(({ id, uses }) => found(query, words(id, Object.keys(uses ?? {}))))
  const make = async ({ id }) => {
    const name = id.trim()
    if (!ID.test(name)) return setMaking({ ...making, problem: tr('包 id 用小写字母、数字和连字符，字母开头', 'A package id is lowercase letters, digits and dashes, a letter first') })
    try {
      await onCreate({ id: name, ...(making.empty ? { empty: true } : { from: making.from }) })
      setMaking(null)
    } catch (error) {
      setMaking({ ...making, problem: error.message })
    }
  }
  const addOptions = onCreate ? [
    { value: 'empty', label: tr('空白包', 'Empty package') },
    ...(picked ? [{ value: 'copy', label: tr(`复制 ${picked}`, `Copy of ${picked}`) }] : []),
  ] : []
  return (
    <nav className="project-list" aria-label={tr('包', 'Packages')}>
      <SidebarListTools query={query} onQuery={setQuery} addOptions={disabled ? [] : addOptions} addLabel={tr('新建包', 'New package')}
        onAdd={(value) => setMaking(value === 'empty' ? { empty: true } : { from: picked })} />
      {making && <NewForm heading={making.empty ? tr('新建空白包', 'New empty package') : tr(`复制 ${making.from} 为新包`, `New package, a copy of ${making.from}`)}
        fields={[['id', tr('包 id', 'Package id')]]} problem={making.problem} onMake={make} onCancel={() => setMaking(null)} />}
      {listed.map(({ id, uses }) => {
        const deps = Object.keys(uses ?? {})
        return (
          <Row key={id} id={id} icon={Package} name={id} open={id === current} picked={id === picked} disabled={disabled} onPick={onPick} onOpen={onOpen}
            title={deps.length ? `${id} · ${tr('用到', 'Uses')} ${deps.join(', ')}` : id}>
            {deps.length > 0 && <small>{deps.join(' · ')}</small>}
          </Row>
        )
      })}
      {!listed.length && <p className="project-none">{tr('没有符合的包', 'No package matches')}</p>}
    </nav>
  )
}

/**
 * The games: `current` the one open, `picked` the one whose meta shows; `onCreate({ id, from, title })`, when given,
 * makes a new game on the picked game's package, keeping its course settings.
 */
export function GameList({ games, current, picked, disabled, onPick, onOpen, onCreate = null }) {
  const [query, setQuery] = useState('')
  const [making, setMaking] = useState(null) // { from }, and the last refusal
  const listed = games.filter((g) => found(query, words(g.id, g.title, g.package)))
  const from = games.find((g) => g.id === (picked ?? current))
  const make = async ({ id, zh, en }) => {
    const name = id.trim()
    if (!ID.test(name)) return setMaking({ ...making, problem: tr('游戏 id 用小写字母、数字和连字符，字母开头', 'A game id is lowercase letters, digits and dashes, a letter first') })
    try {
      await onCreate({ id: name, from: making.from, title: { zh: zh.trim() || name, en: en.trim() || name } })
      setMaking(null)
    } catch (error) {
      setMaking({ ...making, problem: error.message })
    }
  }
  const addOptions = onCreate && from ? [{ value: 'new', label: tr(`在 ${from.package} 上新建游戏`, `New game on ${from.package}`) }] : []
  return (
    <nav className="project-list" aria-label={tr('游戏', 'Games')}>
      <SidebarListTools query={query} onQuery={setQuery} addOptions={disabled ? [] : addOptions} addLabel={tr('新建游戏', 'New game')} onAdd={() => setMaking({ from: from.id })} />
      {making && <NewForm heading={tr(`在 ${from?.package} 上新建游戏（课程设置照 ${making.from}）`, `New game on ${from?.package} (course settings as ${making.from})`)}
        fields={[['id', tr('游戏 id', 'Game id')], ['zh', '中文名'], ['en', 'English name']]} problem={making.problem} onMake={make} onCancel={() => setMaking(null)} />}
      {listed.map((g) => (
        <Row key={g.id} id={g.id} icon={Gamepad2} name={L(g.title) ?? g.id} open={g.id === current} picked={g.id === picked} disabled={disabled} onPick={onPick} onOpen={onOpen}
          title={`${L(g.title) ?? g.id} · ${g.id} · ${g.package}`}>
          <code>{g.id}</code>
        </Row>
      ))}
      {!listed.length && <p className="project-none">{tr('没有符合的游戏', 'No game matches')}</p>}
    </nav>
  )
}

/** Its head: what it is, and Open (or that it is open). */
function MetaHead({ icon: Icon, id, children, open, disabled, onOpen, openLabel }) {
  return (
    <header className="package-meta-head">
      <Icon size={15} aria-hidden="true" />
      <code>{id}</code>
      {children}
      <span className="kit-spacer" />
      {open ? <span className="object-kind">{tr('打开中', 'Open')}</span>
        : <button type="button" className="kit-btn is-label" disabled={disabled} onClick={() => onOpen(id)}>{openLabel}</button>}
    </header>
  )
}

const short = (hash) => (hash ? String(hash).slice(0, 8) : '—')
const none = <span className="package-meta-none">{tr('无', 'None')}</span>

/** Whether a dependency lock holds, and what it holds each dependency at. */
function Lock({ lock, status }) {
  const ok = status?.valid !== false
  return (
    <>
      <h3 className="package-meta-file">{tr('依赖锁定', 'Dependency lock')}</h3>
      <dl className="package-facts">
        <dt>{tr('状态', 'State')}</dt>
        <dd className={ok ? 'is-ok' : 'is-error'}>{ok ? tr('与依赖现状一致', 'Matches the dependencies as they are') : (status?.problems ?? []).join('; ') || tr('不一致', 'Out of date')}</dd>
        {Object.entries(lock?.dependencies ?? {}).map(([dep, at]) => <Fragment key={dep}><dt>{dep}</dt><dd><code>{at.version}</code><code className="package-meta-hash" title={at.hash}>{short(at.hash)}</code></dd></Fragment>)}
      </dl>
    </>
  )
}

// The kinds of a package's public surface, as the meta names them (any other by its own name).
const SURFACE = {
  level: ['关卡', 'Levels'], task: ['任务', 'Tasks'], entry: ['词条', 'Entries'], tag: ['标签', 'Tags'], relation: ['关系', 'Relations'],
  section: ['百科分组', 'Encyclopedia sections'], kind: ['类型声明', 'Kind declarations'], menu: ['菜单', 'Menus'], i18n: ['文案键', 'Text keys'],
  export: ['代码导出', 'Code exports'], display: ['显示', 'Displays'],
}

/**
 * A package's meta (read only: package.json is written by hand): its version, the kernel and the packages it needs,
 * the packages and games that need it, whether its dependency lock holds, its code, and what its public surface
 * holds, kind by kind.
 */
export function PackageMeta({ packages, games = [], id, open, disabled, onOpen }) {
  const info = packages.find((p) => p.id === id)
  if (!info) return null
  const uses = Object.entries(info.uses ?? {})
  const usedBy = packages.filter((p) => Object.hasOwn(p.uses ?? {}, id)).map((p) => p.id)
  const playedBy = games.filter((g) => Object.hasOwn(g.packages ?? {}, id)).map((g) => g.id)
  const surface = Object.values(info.manifest?.surface ?? {}).reduce((n, { kind }) => (kind === 'package' ? n : n.set(kind, (n.get(kind) ?? 0) + 1)), new Map())
  const kinds = [...surface].sort((a, b) => (a[0] === 'i18n') - (b[0] === 'i18n') || b[1] - a[1] || a[0].localeCompare(b[0]))
  const exportsOf = Object.entries(info.manifest?.exports ?? {})
  return (
    <article className="package-meta">
      <MetaHead icon={Package} id={id} open={id === open} disabled={disabled} onOpen={onOpen} openLabel={tr('打开这个包', 'Open this package')} />
      <h3 className="package-meta-file">package.json</h3>
      <dl className="package-facts">
        <dt>{tr('版本', 'Version')}</dt><dd><code>{info.version ?? '—'}</code></dd>
        <dt>{tr('内核', 'Kernel')}</dt><dd><code>{info.kernel ?? '—'}</code></dd>
        <dt>{tr('依赖', 'Uses')}</dt><dd>{uses.length ? uses.map(([dep, range]) => <code key={dep}>{dep} {range}</code>) : none}</dd>
        <dt>{tr('被哪些包用到', 'Used by packages')}</dt><dd>{usedBy.length ? usedBy.map((u) => <code key={u}>{u}</code>) : none}</dd>
        <dt>{tr('被哪些游戏选用', 'Played by games')}</dt><dd>{playedBy.length ? playedBy.map((g) => <code key={g}>{g}</code>) : none}</dd>
      </dl>
      <Lock lock={info.lock} status={info.lockStatus} />
      {exportsOf.length > 0 && <>
        <h3 className="package-meta-file">{tr('代码', 'Code')}</h3>
        <dl className="package-facts">
          {exportsOf.map(([side, names]) => <Fragment key={side}><dt>{side}</dt><dd>{names.length > 8
            ? <details className="package-meta-more"><summary>{tr(`${names.length} 个导出`, `${names.length} exports`)}</summary>{names.map((n) => <code key={n}>{n}</code>)}</details>
            : names.map((n) => <code key={n}>{n}</code>)}</dd></Fragment>)}
        </dl>
      </>}
      <h3 className="package-meta-file">{tr('公开内容', 'Public surface')}</h3>
      <dl className="package-facts">
        {kinds.map(([kind, n]) => <Fragment key={kind}><dt>{SURFACE[kind] ? tr(...SURFACE[kind]) : kind}</dt><dd>{n}</dd></Fragment>)}
        <dt>{tr('文件', 'Files')}</dt><dd>{Object.keys(info.manifest?.files ?? {}).length}</dd>
        <dt>{tr('内容哈希', 'Content hash')}</dt><dd><code className="package-meta-hash" title={info.manifest?.hash}>{short(info.manifest?.hash)}</code></dd>
      </dl>
    </article>
  )
}

/** A game's meta (read only here: its own files are edited in the workspace): its title, its main package, the
 *  packages it plays (game.json `packages`), the kernel it needs, and whether its dependency lock holds. */
export function GameMeta({ games, id, open, disabled, onOpen }) {
  const info = games.find((g) => g.id === id)
  if (!info) return null
  const plays = Object.entries(info.packages ?? {})
  return (
    <article className="package-meta">
      <MetaHead icon={Gamepad2} id={id} open={id === open} disabled={disabled} onOpen={onOpen} openLabel={tr('打开这款游戏', 'Open this game')} />
      <h3 className="package-meta-file">game.json</h3>
      <dl className="package-facts">
        <dt>{tr('名字', 'Title')}</dt><dd>{L(info.title) ?? '—'}</dd>
        <dt>{tr('主包', 'Main package')}</dt><dd><code>{info.package ?? '—'}</code></dd>
        <dt>{tr('内核', 'Kernel')}</dt><dd><code>{info.kernel ?? '—'}</code></dd>
        <dt>{tr('选用的包', 'Packages played')}</dt><dd>{plays.length ? plays.map(([p, range]) => <code key={p}>{p} {range}</code>) : none}</dd>
      </dl>
      <Lock lock={info.lock} status={info.lockStatus} />
    </article>
  )
}

/** A file as JSON, read only, in the right column: `name` its file name, `note` why it is not edited here. */
export function JsonFile({ name, value, note = null }) {
  return (
    <article className="json-file">
      <header className="json-file-head"><code>{name}</code>{note && <small>{note}</small>}</header>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </article>
  )
}

/** A package's package.json, as the packages list knows it. */
export const packageJson = (info) => info && Object.fromEntries(['version', 'kernel', 'uses'].filter((k) => info[k] !== undefined).map((k) => [k, info[k]]))

/** What the games list knows of a game's game.json (its texts by their keys). */
export const gameJson = (info) => info && {
  kernel: info.kernel,
  packages: info.packages,
  ...(info.title && { title: info.title.$key ?? info.title }),
}
