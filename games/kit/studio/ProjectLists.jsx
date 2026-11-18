import { T } from '../shell/i18n.js'
// What the studio's workspaces open, listed in their left columns (games/design/README.md 6.7): the packages (Build, Copy)
// and the games (Arrange, Copy), each its own list with a search. A click picks one, its meta goes in the middle
// (PackageMeta, GameMeta, read only) and its file in the right column (package.json, game.json: JsonFile, or the
// open game's in the Inspector, where it is edited); a double click, Enter, or the meta's Open opens it, the workspace's pending
// operations given up after asking. A list may make a new one (`making`): a package empty or copied from the one
// picked, a game on the picked game's package.
import { Fragment, useState } from 'react'
import { Gamepad2, Package } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import SidebarListTools from './SidebarListTools.jsx'
import SidebarGrouping from './SidebarGrouping.jsx'
import { PackageName, packageSidebarGroups, packageKindLabel } from './PackageGroups.jsx'
import { PACKAGE_KINDS } from '../engine/package-kinds.js'
import { sourceValue } from '../engine/catalogs.js'
import { objectTypes } from './object-types.js'
import { typeName } from './LeftTypes.jsx'

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
      title={`${title}${open ? '' : ` — ${tr("双击打开")}`}`}>
      <i className="family-chip"><Icon size={12} aria-hidden="true" /></i>
      <span>{name}</span>
      {children}
      {open && <b className="project-pick-open">{tr("打开中")}</b>}
    </button>
  )
}

/** The form a new package or game is named in, at the top of its list. `fields`: [key, placeholder, options?] (with
 *  options, a choice among them, the first to start with). */
function NewForm({ heading, fields, problem, onMake, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(([key, , options]) => [key, options ? options[0].value : ''])))
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try { await onMake(values) } finally { setBusy(false) }
  }
  return (
    <form className="project-new" onSubmit={submit}>
      <strong>{heading}</strong>
      {fields.map(([key, placeholder, options], k) => (options
        ? <select key={key} className="studio-game" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} aria-label={placeholder} disabled={busy}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        : <input key={key} className="field-input" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder={placeholder} aria-label={placeholder}
          autoFocus={k === 0} spellCheck={false} disabled={busy} />
      ))}
      {problem && <small className="is-error" role="status">{problem}</small>}
      <span className="project-new-actions">
        <button type="submit" className="kit-btn is-label is-solid" disabled={busy}>{busy ? tr("建立中……") : tr("建立")}</button>
        <button type="button" className="kit-btn is-label" disabled={busy} onClick={onCancel}>{tr("取消")}</button>
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
  const listed = [...packages].sort((a, b) => a.id.localeCompare(b.id)).filter(({ id, title, uses }) => found(query, words(id, title, Object.keys(uses ?? {}))))
  const make = async ({ id, kind: chosen }) => {
    const name = id.trim()
    if (!ID.test(name)) return setMaking({ ...making, problem: tr("包 id 用小写字母、数字和连字符，字母开头") })
    try {
      // An empty package is of the kind chosen; a copy is of its source's kind.
      await onCreate({ id: name, ...(making.empty ? { empty: true, kind: chosen } : { from: making.from }) })
      setMaking(null)
    } catch (error) {
      setMaking({ ...making, problem: error.message })
    }
  }
  const addOptions = onCreate ? [
    { value: 'empty', label: tr("空白包") },
    ...(picked ? [{ value: 'copy', label: tr("复制 {picked}", {picked}) }] : []),
  ] : []
  return (
    <nav className="project-list" aria-label={tr("包")}>
      <SidebarGrouping scope="package-projects" groupsOf={by => packageSidebarGroups(listed, by)} tools={{
        query, onQuery: setQuery, addOptions: disabled ? [] : addOptions, addLabel: tr("包"),
        onAdd: value => setMaking(value === 'empty' ? { empty: true } : { from: picked }),
      }} row={({ id, title, desc }) => (
        <Row key={id} id={id} icon={Package} name={L(title)} title={L(desc)} open={id === current} picked={id === picked} disabled={disabled} onPick={onPick} onOpen={onOpen}><code>{id}</code></Row>
      )}>
        {making && <NewForm heading={making.empty ? tr("新建空白包") : tr("复制 {from} 为新包", {from: making.from})}
          fields={[['id', tr("包 id")], ...(making.empty ? [['kind', tr("包种类"), PACKAGE_KINDS.map((k) => ({ value: k, label: `${kindName(k)} (${k})` }))]] : [])]}
          problem={making.problem} onMake={make} onCancel={() => setMaking(null)} />}
      </SidebarGrouping>
      {!listed.length && <p className="project-none">{tr("没有符合的包")}</p>}
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
    if (!ID.test(name)) return setMaking({ ...making, problem: tr("游戏 id 用小写字母、数字和连字符，字母开头") })
    try {
      await onCreate({ id: name, from: making.from, title: { zh: zh.trim() || name, en: en.trim() || name } })
      setMaking(null)
    } catch (error) {
      setMaking({ ...making, problem: error.message })
    }
  }
  const addOptions = onCreate && from ? [{ value: 'new', label: tr("在 {package} 上新建游戏", {package: from.package}) }] : []
  return (
    <nav className="project-list" aria-label={tr("游戏")}>
      <SidebarListTools query={query} onQuery={setQuery} addOptions={disabled ? [] : addOptions} addLabel={tr("新建游戏")} onAdd={() => setMaking({ from: from.id })} />
      {making && <NewForm heading={tr("在 {package} 上新建游戏（课程设置照 {from}）", {package: from?.package, from: making.from})}
        fields={[['id', tr("游戏 id")], ['zh', '中文名'], ['en', 'English name']]} problem={making.problem} onMake={make} onCancel={() => setMaking(null)} />}
      {listed.map((g) => (
        <Row key={g.id} id={g.id} icon={Gamepad2} name={L(g.title) ?? g.id} open={g.id === current} picked={g.id === picked} disabled={disabled} onPick={onPick} onOpen={onOpen}
          title={`${L(g.title) ?? g.id} · ${g.id} · ${g.package}`}>
          <code>{g.id}</code>
        </Row>
      ))}
      {!listed.length && <p className="project-none">{tr("没有符合的游戏")}</p>}
    </nav>
  )
}

/** Its head: what it is, and Open (or that it is open). */
function MetaHead({ icon: Icon, id, info, children, open, disabled, onOpen, openLabel }) {
  return (
    <header className="package-meta-head">
      <Icon size={15} aria-hidden="true" />
      {info ? <PackageName info={info} /> : <code>{id}</code>}
      {children}
      <span className="kit-spacer" />
      {open ? <span className="object-kind">{tr("打开中")}</span>
        : <button type="button" className="kit-btn is-label" disabled={disabled} onClick={() => onOpen(id)}>{openLabel}</button>}
    </header>
  )
}

/** A package kind's name (play, extension, course, library), or the kind itself when it is not one of those. */
const kindName = (kind) => { try { return packageKindLabel(kind) } catch { return kind } }
const short = (hash) => (hash ? String(hash).slice(0, 8) : '—')
const none = <span className="package-meta-none">{tr("无")}</span>

/** A game as a package is shown (PackageGroups.jsx PackageName): its title, its id small. */
export function GameName({ info }) {
  return <span className="package-name" title={L(info.lede) ?? undefined}><span>{L(info.title) ?? info.id}</span><code>{info.id}</code></span>
}

function GameRef({ games, id }) {
  const info = games.find(game => game.id === id)
  return info ? <GameName info={info} /> : <code>{id}</code>
}

function PackageRef({ packages, id, range }) {
  const info = packages.find(pkg => pkg.id === id)
  return info ? <PackageName info={info} range={range} /> : <code>{id} {range}</code>
}

/** Whether a dependency lock holds, and what it holds each dependency at. */
function Lock({ lock, status, packages }) {
  const ok = status?.valid !== false
  return (
    <>
      <h3 className="package-meta-file">{tr("依赖锁定")}</h3>
      <dl className="package-facts">
        <dt>{tr("状态")}</dt>
        <dd className={ok ? 'is-ok' : 'is-error'}>{ok ? tr("与依赖现状一致") : (status?.problems ?? []).join('; ') || tr("不一致")}</dd>
        {Object.entries(lock?.dependencies ?? {}).map(([dep, at]) => <Fragment key={dep}><dt><PackageRef packages={packages} id={dep} /></dt><dd><code>{at.version}</code><code className="package-meta-hash" title={at.hash}>{short(at.hash)}</code></dd></Fragment>)}
      </dl>
    </>
  )
}

// The kinds of a package's public surface, as the meta names them (any other by its own name).
const SURFACE = {
  level: T("关卡"), task: T("任务", {}, "project-lists"), entry: T("词条"), tag: T("标签"), relation: T("关系"),
  section: T("百科分组"), kind: T("类型声明"), menu: T("菜单"), i18n: T("文案键"),
  export: T("代码导出"), display: T("显示", {}, "project-lists"),
  play: T("玩法"), playView: T("玩法界面"), agent: T("盲玩代理"), check: T("检查", {}, "project-lists"),
  kindMeaning: T("类型含义"), shape: T("命名形状"), editor: T("编辑器", {}, "project-lists"),
  editorExtension: T("编辑器扩展"), gameHook: T("游戏钩子"), unlocks: T("通关解锁项"),
  valueType: T("值类型"), language: T("语言", {}, "project-lists"),
}

/** What a package's public surface holds, kind by kind ([kind, count], text keys last). */
export function surfaceCounts(info) {
  const surface = Object.values(info.manifest?.surface ?? {}).reduce((n, { kind }) => (kind === 'package' ? n : n.set(kind, (n.get(kind) ?? 0) + 1)), new Map())
  return [...surface].sort((a, b) => (a[0] === 'i18n') - (b[0] === 'i18n') || b[1] - a[1] || a[0].localeCompare(b[0]))
}

/**
 * The names the loaded content gives the kinds packages declare: object kinds (their Studio names) and capability kinds
 * (their `studio.label`), by full name. A kind the content does not load keeps its id.
 */
export function surfaceLabels(content, vocabulary) {
  const labels = {}
  for (const info of objectTypes(content)) labels[info.type] = L(typeName(info))
  for (const [kind, definition] of Object.entries(vocabulary?.capabilityKinds ?? {})) if (definition?.studio?.label) labels[kind] = L(definition.studio.label)
  return labels
}

/** The name of a kind of public content: the kernel's (SURFACE), else the one its package declares (`labels`), else its id. */
export const surfaceName = (kind, labels = {}) => (SURFACE[kind] ? L(SURFACE[kind]) : labels[kind] ?? <code>{kind}</code>)

/**
 * The packages and games that use a package, each by title and id.
 */
export function PackageUsers({ packages, games, id }) {
  const usedBy = packages.filter((p) => Object.hasOwn(p.uses ?? {}, id)).map((p) => p.id)
  const playedBy = games.filter((g) => Object.hasOwn(g.packages ?? {}, id)).map((g) => g.id)
  return (
    <>
      <dt>{tr("被哪些包用到")}</dt><dd>{usedBy.length ? usedBy.map((u) => <PackageRef key={u} packages={packages} id={u} />) : none}</dd>
      <dt>{tr("被哪些游戏选用")}</dt><dd>{playedBy.length ? playedBy.map((g) => <GameRef key={g} games={games} id={g} />) : none}</dd>
    </>
  )
}

/**
 * A package's meta (read only: package.json is written by hand): its version, the kernel and the packages it needs,
 * the packages and games that need it, whether its dependency lock holds, its code, and what its public surface
 * holds, kind by kind.
 */
export function PackageMeta({ packages, games = [], id, open, disabled, onOpen, labels = {} }) {
  const info = packages.find((p) => p.id === id)
  if (!info) return null
  const uses = Object.entries(info.uses ?? {})
  const kinds = surfaceCounts(info)
  const exportsOf = Object.entries(info.manifest?.exports ?? {})
  return (
    <article className="package-meta">
      <MetaHead icon={Package} id={id} info={info} open={id === open} disabled={disabled} onOpen={onOpen} openLabel={tr("打开这个包")} />
      <p className="package-description">{L(info.desc)}</p>
      <h3 className="package-meta-file">package.json</h3>
      <dl className="package-facts">
        <dt>{tr("种类")}</dt><dd>{info.kind ? <>{kindName(info.kind)} <code>{info.kind}</code></> : none}</dd>
        <dt>{tr("版本")}</dt><dd><code>{info.version ?? '—'}</code></dd>
        <dt>{tr("内核")}</dt><dd><code>{info.kernel ?? '—'}</code></dd>
        <dt>{tr("依赖")}</dt><dd>{uses.length ? uses.map(([dep, range]) => <PackageRef key={dep} packages={packages} id={dep} range={range} />) : none}</dd>
        <PackageUsers packages={packages} games={games} id={id} />
      </dl>
      <Lock lock={info.lock} status={info.lockStatus} packages={packages} />
      {exportsOf.length > 0 && <>
        <h3 className="package-meta-file">{tr("代码")}</h3>
        <dl className="package-facts">
          {exportsOf.map(([side, names]) => <Fragment key={side}><dt>{side}</dt><dd>{names.length > 8
            ? <details className="package-meta-more"><summary>{tr("{length} 个导出", {length: names.length})}</summary>{names.map((n) => <code key={n}>{n}</code>)}</details>
            : names.map((n) => <code key={n}>{n}</code>)}</dd></Fragment>)}
        </dl>
      </>}
      <h3 className="package-meta-file">{tr("公开内容")}</h3>
      <dl className="package-facts">
        {kinds.map(([kind, n]) => <Fragment key={kind}><dt>{surfaceName(kind, labels)}</dt><dd>{n}</dd></Fragment>)}
        <dt>{tr("文件")}</dt><dd>{Object.keys(info.manifest?.files ?? {}).length}</dd>
        <dt>{tr("内容哈希")}</dt><dd><code className="package-meta-hash" title={info.manifest?.hash}>{short(info.manifest?.hash)}</code></dd>
      </dl>
    </article>
  )
}

/** A game's meta (read only here: its own files are edited in the workspace): its title, its main package, the
 *  packages it plays (game.json `packages`), the kernel it needs, and whether its dependency lock holds. */
export function GameMeta({ games, packages, id, open, disabled, onOpen }) {
  const info = games.find((g) => g.id === id)
  if (!info) return null
  const plays = Object.entries(info.packages ?? {})
  return (
    <article className="package-meta">
      <MetaHead icon={Gamepad2} id={id} open={id === open} disabled={disabled} onOpen={onOpen} openLabel={tr("打开这款游戏")} />
      <h3 className="package-meta-file">game.json</h3>
      <dl className="package-facts">
        <dt>{tr("名字")}</dt><dd>{L(info.title) ?? '—'}</dd>
        <dt>{tr("主包")}</dt><dd><PackageRef packages={packages} id={info.package} /></dd>
        <dt>{tr("内核")}</dt><dd><code>{info.kernel ?? '—'}</code></dd>
        <dt>{tr("选用的包")}</dt><dd>{plays.length ? plays.map(([p, range]) => <PackageRef key={p} packages={packages} id={p} range={range} />) : none}</dd>
      </dl>
      <Lock lock={info.lock} status={info.lockStatus} packages={packages} />
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
export const packageJson = (info) => info && sourceValue(Object.fromEntries(['kind', 'title', 'desc', 'type', 'version', 'kernel', 'uses'].filter((k) => info[k] !== undefined).map((k) => [k, info[k]])))

/** What the games list knows of a game's game.json (its texts by their keys). */
export const gameJson = (info) => info && {
  kernel: info.kernel,
  packages: info.packages,
  ...(info.title && { title: info.title.$key ?? info.title }),
}
