import { PackageDependencies, PackageName, packageKindLabel, packageSidebarGroups } from './PackageGroups.jsx'
// The game workspace of the studio (games/design/README.md 6.7): where a course designer makes a game on a package and
// arranges its learning route. On the left a list (left-lists.js GAME_LISTS): the game's settings and its chapters, or
// the overrides it sees; in the middle what is picked: a chapter's fields and its board (ChapterBoard.jsx: whole level
// groups and single levels placed, the links between them, the map's layout), the game's settings as rows, the copy
// (the game's own texts, and its own wording over the package's, which the package keeps as it is), the changes, or an
// override's fields before and after; the file of what is picked on the right (Inspector.jsx); the audit under the
// middle. Only
// the game's side of the operation set runs here (useChangeset.js): the course, the game's texts and its overrides.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BookMarked, Gamepad2, Hammer, Layers, ListTree, Map as MapIcon, Minus, Package, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { L, T, getLang, tr } from '../shell/i18n.js'
import { contentVocabulary } from './editors.js'
import { parsePath } from '../engine/ops/edit.js'
import { isText, textEntries } from '../engine/i18n.js'
import { call } from './api.js'
import { placesOf } from './form.js'
import { itemOf } from './worklist.js'
import { usePref } from './prefs.js'
import { confirmDelete } from './delete.js'
import { blankChapter, chapterName, chaptersOrder, moveChapter, newChapterName } from './course-edit.js'
import { missingDependencies, packageAddOps, packageRemoveOps } from './game-packages.js'
import { useChangeset } from './useChangeset.js'
import StudioBar from './StudioBar.jsx'
import PanelResizer from './PanelResizer.jsx'
import ChapterBoard from './ChapterBoard.jsx'
import { OverrideDetail, OverrideList, visibleOverrides } from './OverrideAudit.jsx'
import { GAME_LISTS, OBJECT_LISTS, openParams, overrideKey, readOpen } from './left-lists.js'
import Review from './Review.jsx'
import Audit, { auditSum } from './Audit.jsx'
import Drawer, { Debug } from './Drawer.jsx'
import Inspector from './Inspector.jsx'
import { GameList, GameMeta, JsonFile, PackageUsers, surfaceCounts, surfaceLabels, surfaceName } from './ProjectLists.jsx'
import SidebarListTools from './SidebarListTools.jsx'
import SidebarGrouping from './SidebarGrouping.jsx'
import ListRow from './ListRow.jsx'
import GameFrame from './GameFrame.jsx'
import { useWorkspaceKeys } from '../shell/useOverlay.js'
import { MOD } from './Shortcuts.jsx'

const QUERY = new URLSearchParams(window.location.search)
const SCOPE = 'game'
const OPENED = readOpen(QUERY, GAME_LISTS)
const LISTS = { games: [Gamepad2, T("游戏")], packages: [Package, T("用到的包")], chapters: [ListTree, T("章节")], overrides: [Layers, T("覆盖")] }
const SETTLE = 700

const remember = (game, at, opened) => {
  const url = new URL(window.location.href)
  url.searchParams.set('game', game)
  url.searchParams.set('space', 'arrange')
  url.searchParams.delete('tab')
  for (const k of ['package', 'scope', 'file', 'level', 'group', 'era', 'glossary', ...Object.values(OBJECT_LISTS)]) url.searchParams.delete(k)
  if (at?.era !== undefined) url.searchParams.set('era', at.era)
  for (const [k, v] of opened) url.searchParams.set(k, v)
  window.history.replaceState(null, '', url)
}

/**
 * `game`: the game arranged; `games`: every game, { id, title, package }; `onMade(id)`: a game was just made;
 * `packages`: every package, { id, uses }; `onBuild(id)` opens a package in the build workspace.
 */
export default function GameStudio({ game, games, onGame, onMade, packages = [], onBuild, space }) {
  const pending = useChangeset(game, SCOPE)
  const { ops, redo, why, setWhy, shown, last, checked, busy, rev, saving, said, fresh, lines, result, edit, addOps, back, again, discard, apply, undo } = pending
  const [domainVocab, setVocab] = useState(null)
  const [rawNames, setRawNames] = useState(null)
  const [at, setAt] = useState(() => (QUERY.get('era') !== null ? { era: Number(QUERY.get('era')) } : { era: 0 }))
  const [drawerTab, setDrawerTab] = usePref('game-drawer-tab', 'audit') // the fold bar's tab (Drawer.jsx)
  const [savedSide, setSide] = usePref('game-side', 'chapters')
  useLayoutEffect(() => { if (OPENED.list) setSide(OPENED.list) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const side = GAME_LISTS.includes(savedSide) ? savedSide : 'chapters'
  const overridesShown = side === 'overrides'
  const packagesShown = side === 'packages'
  const [packageAt, setPackageAt] = useState(null) // the package picked in the packages list
  const [openOverride, setOpenOverride] = useState(OPENED.open.override ?? null)
  const openDrawer = (next) => {
    setDrawerTab(next)
    setLayout((l) => (l.auditOpen ? l : { ...l, auditOpen: true }))
  }
  const [field, setField] = useState(null)
  const [pickedGame, setPickedGame] = useState(game) // the game picked in the games list: its meta on the right
  const [chapterQuery, setChapterQuery] = useState('')
  const chapterMatches = (chapter) => { const q = chapterQuery.trim().toLowerCase(); return !q || `${chapter.id} ${L(chapter.title ?? chapter.chapter?.title) ?? ''}`.toLowerCase().includes(q) }
  const gamesShown = side === 'games'
  // The game played in the middle, as a player meets it (GameFrame.jsx, play mode only): `playing` shows it instead of
  // the chapter board; `playAt` is where it opened ({ level }, or the map); the frame, once opened, stays loaded while
  // hidden, so going back to it finds the game as it was left.
  const [playing, setPlaying] = useState(false)
  const [playAt, setPlayAt] = useState(null)
  const [playOpened, setPlayOpened] = useState(false)
  const playGame = (level = null) => {
    setPlayAt(level ? { level } : { map: Date.now() })
    setPlaying(true)
    setPlayOpened(true)
  }
  const [layout, setLayout] = usePref('game-layout', { tree: 220, audit: 200, side: 360, treeOpen: true, auditOpen: true, sideOpen: true })
  const [resize, setResize] = useState(null)
  useEffect(() => {
    setVocab(null)
    setRawNames(null)
    setField(null)
    call('vocabulary', { game }).then(setVocab)
  }, [game])
  const content = shown?.content ?? null
  const loaded = Boolean(content)
  // Names for the links in the copy, as the changeset leaves the game.
  const namesSeq = useRef(0)
  const naming = useMemo(() => JSON.stringify(ops.filter((op) => op.op !== 'text.override')), [ops])
  useEffect(() => {
    if (!loaded) return undefined
    const no = ++namesSeq.current
    const timer = window.setTimeout(() => call('names', { game, scope: SCOPE, changeset: { ops: JSON.parse(naming) } }).then((r) => no === namesSeq.current && setRawNames(r)).catch(() => {}), naming === '[]' ? 0 : SETTLE)
    return () => window.clearTimeout(timer)
  }, [game, naming, rev, loaded])
  const vocab = useMemo(() => domainVocab && { ...domainVocab, vocabulary: contentVocabulary(domainVocab.vocabulary, content) }, [domainVocab, content])
  // The course as game.json writes it: the forms and the side panel edit it so.
  const course = useMemo(() => content && { ...content, chapters: content.sourceChapters ?? [] }, [content])
  const names = useMemo(() => rawNames && {
    level: new Map(rawNames.levels.map((l) => [l.id, l])),
    part: new Map((rawNames.parts ?? []).map((p) => [p.key, p.name])),
    wiki: new Map((rawNames.entries ?? []).map((e) => [e.id, e.title])),
    onLevel: () => {},
  }, [rawNames])
  const levelOptions = useMemo(() => content?.levels.map((l) => ({ value: l.id, label: l.id, title: l.title })) ?? null, [content])
  const items = useMemo(() => lines.map(itemOf), [lines])
  const places = useMemo(() => placesOf(lines, checked?.order ?? shown?.order ?? []), [lines, checked, shown])

  const layer = `@${game}`
  const events = useMemo(() => visibleOverrides(content, layer), [content, layer])
  const openEvent = overridesShown ? events.find((event) => overrideKey(event) === openOverride) ?? events[0] ?? null : null
  const openedParams = openEvent ? openParams('overrides', { override: overrideKey(openEvent) }) : []
  useEffect(() => remember(game, at, openedParams), [game, at, JSON.stringify(openedParams)]) // eslint-disable-line react-hooks/exhaustive-deps
  // The packages this game plays (game.json `packages`, the layers it loads on) and the one picked in the list.
  const used = content?.layerUses?.[layer] ?? []
  const packageShown = packages.some((p) => p.id === packageAt) ? packageAt : used[0] ?? packages[0]?.id ?? null
  // Package operations are tried on the pending changeset first: the kernel's refusal is said where they were asked.
  const tryOps = async (next) => {
    const r = await call('preview', { game, scope: SCOPE, changeset: { ops: [...ops, ...next] }, check: false, omit: ['content', 'changes', 'log', 'drift'] }).catch((error) => ({ failed: 0, problems: [error.message] }))
    if (r.failed !== null && r.failed !== undefined) return r.problems?.join('; ') || tr('操作失败')
    addOps(next)
    return null
  }
  const eras = course?.chapters ?? []
  const e = at?.era !== undefined && eras[at.era] ? at.era : null
  // The chapter picked, as the right column edits it: its own file (object-file.js).
  const chapterFile = !at?.game && e !== null ? { object: { kind: 'chapter', full: eras[e].id, namespace: layer, own: true } } : null
  const select = (next) => {
    setSide('chapters')
    setAt(next)
    if (next?.game || next?.era !== at?.era) setField(null)
  }
  const pickField = (path) => {
    setLayout((l) => (l.sideOpen ? l : { ...l, sideOpen: true }))
    setField({ path })
  }
  // A chapter is its own object (course-edit.js); the game's `chapters` list orders them.
  const newChapter = () => {
    const name = newChapterName(eras)
    const { id: _, ...fields } = blankChapter(eras, eras.at(-1) ?? {}, (fields) => retitled(fields))
    addOps([{ op: 'chapter.put', chapter: name, data: fields }, chaptersOrder([...eras, { id: `${layer}/${name}` }])])
    select({ era: eras.length })
  }
  const removeChapter = (k) => {
    if (eras[k].levels.length || eras.length === 1 || !confirmDelete(L(eras[k].title ?? eras[k].chapter?.title) ?? String(eras[k].id))) return
    addOps([chaptersOrder(eras.filter((_, i) => i !== k)), { op: 'chapter.remove', chapter: chapterName(eras[k].id) }])
    select({ era: Math.max(0, k - 1) })
  }
  const shift = (k, by) => {
    edit(chaptersOrder(moveChapter(eras, k, by)))
    select({ era: k + by })
  }
  // Another game opened from the games list (the pending operations given up, after asking).
  const openGame = (id) => {
    if (id === game || saving) return
    if (ops.length && !window.confirm(tr("换一款游戏会放弃待定操作，确定吗？"))) return
    onGame(id)
    select({ era: 0 })
  }
  // A new game on the picked game's package (create_game keeps its course settings), then opened.
  const makeGame = async (args) => {
    await call('create_game', args)
    if (ops.length && !window.confirm(tr("新游戏已建好。打开它会放弃待定操作，现在打开吗？"))) return onMade(null)
    setPickedGame(args.id)
    return onMade(args.id)
  }
  const jumpTo = (item) => {
    const found = /^content: game\.json((?:\.[^\s:[]+|\[\d+\])*): /.exec(item.text)
    if (!found) return
    const path = parsePath(found[1].replace(/^\./, ''))
    if (path[0] === 'chapters' && Number.isInteger(path[1])) select({ era: path[1] })
    else select({ game: true })
    if (path.length) pickField(path)
  }
  const sideCtx = vocab && content && { vocabulary: vocab.vocabulary, levels: content.levels.map((l) => l.id), names, levelOptions, lang: getLang(), onSetting: () => {}, onSettings: () => {}, onPart: () => {} }
  const shownLayout = resize ? { ...layout, [resize.side]: resize.size } : layout
  const style = { '--tree-w': `${layout.treeOpen ? shownLayout.tree : 0}px`, '--audit-h': `${shownLayout.audit}px`, '--side-w': `${layout.sideOpen ? shownLayout.side : 0}px` }
  const resizer = { setLayout, previewResize: setResize, dragging: resize !== null }
  // ⌘/Ctrl+Enter plays the level picked (else the game, from its map), as the build workspace plays a level.
  useWorkspaceKeys((event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter' || !content) return
    event.preventDefault()
    playGame(at?.level ?? null)
  })
  const ready = content && vocab
  const busyEditing = saving || shown?.ops !== ops
  return (
    <div className={`studio ${resize ? 'is-resizing' : ''}`}>
      <StudioBar space={space} ops={ops} busy={busy} fresh={fresh} onUndo={ops.length ? () => back(ops.length - 1) : null} onRedo={redo.length ? again : null} panels={{ tree: layout.treeOpen, side: layout.sideOpen, onToggle: (which) => setLayout((l) => ({ ...l, [`${which}Open`]: !l[`${which}Open`] })) }}>
        <button type="button" className={`studio-open-name ${gamesShown ? 'is-on' : ''}`} onClick={() => setSide('games')} title={tr("在左栏选游戏")}>
          <Gamepad2 size={13} aria-hidden="true" /><span>{L(games.find((g) => g.id === game)?.title) ?? game}</span>
        </button>
        <button type="button" className={`studio-open-name studio-play-toggle ${playing ? 'is-on' : ''}`} aria-pressed={playing}
          onClick={() => (playing ? setPlaying(false) : playOpened ? setPlaying(true) : playGame())} title={`${playing ? tr("回到编排") : tr("试玩这款游戏")} (${MOD}+Enter)`}>
          <Play size={13} aria-hidden="true" /><span>{tr("试玩")}</span>
        </button>
      </StudioBar>
      {!ready ? <div className="studio-loading">{tr('读取中……')}</div> : (
        <div className={`studio-body is-${overridesShown || packagesShown ? 'objects' : 'arrange'} ${layout.treeOpen ? '' : 'no-tree'} ${layout.auditOpen ? '' : 'no-audit'} ${layout.sideOpen ? '' : 'no-side'}`} style={style}>
          <aside className="studio-tree">
            <div className="side-tabs" role="tablist" aria-label={tr("列表")}>
              {GAME_LISTS.map((list) => {
                const [Icon, label] = LISTS[list]
                return (
                  <button key={list} type="button" role="tab" aria-selected={side === list} className={side === list ? 'is-on' : ''} aria-label={L(label)} title={L(label)} onClick={() => setSide(list)}>
                    <Icon size={14} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            {gamesShown ? <GameList games={games} current={game} picked={pickedGame} disabled={saving} onPick={setPickedGame} onOpen={openGame} onCreate={makeGame} />
              : packagesShown ? <UsedPackages packages={packages} used={used} current={packageShown} onOpen={setPackageAt} />
              : overridesShown ? <OverrideList events={events} layer={layer} current={openEvent && overrideKey(openEvent)} onOpen={setOpenOverride} /> : (
            <nav className="tree chapters" aria-label={tr("章节")}>
              <SidebarListTools addOptions={busyEditing ? [] : [{ value: 'chapter', label: tr("新的一章") }]} addLabel={tr("新的一章")} onAdd={newChapter}
                query={chapterQuery} onQuery={setChapterQuery} />
              {eras.map((chapter, k) => !chapterMatches(chapter) ? null : (
                <div key={k} className={`chapter-item ${e === k && !at?.game ? 'is-on' : ''}`}>
                  <ListRow icon={BookMarked} on={e === k && !at?.game} onClick={() => select({ era: k })} title={L(chapter.title ?? chapter.chapter?.title)} id={chapterName(chapter.id)} />
                  <span className="chapter-tools">
                    <button type="button" className="kit-btn editor-tool" disabled={busyEditing || k === 0} onClick={() => shift(k, -1)} title={tr("上移")}><ArrowUp size={12} /></button>
                    <button type="button" className="kit-btn editor-tool" disabled={busyEditing || k === eras.length - 1} onClick={() => shift(k, 1)} title={tr("下移")}><ArrowDown size={12} /></button>
                    <button type="button" className="kit-btn editor-tool" disabled={busyEditing || chapter.levels.length > 0 || eras.length === 1} onClick={() => removeChapter(k)} title={tr("删掉这一章（章里没有关卡时）")}><Trash2 size={12} /></button>
                  </span>
                </div>
              ))}
            </nav>)}
          </aside>
          <PanelResizer side="tree" size={layout.tree} open={layout.treeOpen} {...resizer} />
          <main className="studio-main">
            {playOpened && <GameFrame visible={playing} content={content} play={playAt} task={0} go={null} edit={false} picked={null} editable={false}
              onEdit={() => {}} onMessage={() => {}} onRoot={() => {}}
              tools={<>
                <button type="button" className="kit-btn is-label" onClick={() => setPlayAt({ map: Date.now() })} title={tr("回到这款游戏的地图")}><MapIcon size={14} aria-hidden="true" />{tr("地图")}</button>
                {at?.level && <button type="button" className="kit-btn is-label" onClick={() => playGame(at.level)} title={tr("从编排里选中的这一关开始")}><RotateCcw size={14} aria-hidden="true" />{at.level}</button>}
                <button type="button" className="kit-btn is-label" onClick={() => setPlaying(false)}><ListTree size={14} aria-hidden="true" />{tr("回到编排")}</button>
              </>} />}
            <div className="studio-scroll" hidden={playing}>
              {packagesShown && <PackageCard key={packageShown} id={packageShown} packages={packages} games={games} used={used} labels={surfaceLabels(content, vocab?.vocabulary)} pending={busyEditing} onBuild={onBuild} onOps={tryOps} />}
              {overridesShown && <OverrideDetail event={openEvent} layer={layer} pending={busyEditing} onOps={addOps} onOpen={() => setSide('chapters')} />}
              {gamesShown && <GameMeta games={games} packages={packages} id={pickedGame} open={game} disabled={saving} onOpen={openGame} />}
              {!gamesShown && !overridesShown && !packagesShown && (at?.game || e === null
                ? <article className="editor"><header className="editor-head"><h1>{L(content.title)}</h1></header></article>
                : <>
                  <header className="editor-head chapter-head" onClick={() => pickField([])}>
                    <code className="editor-id is-static">{chapterName(eras[e].id)}</code><h1>{L(eras[e].title ?? eras[e].chapter?.title) ?? ''}</h1>
                  </header>
                  <ChapterBoard content={content} course={course} e={e} at={at} pending={busyEditing} ops={ops} previewOps={shown?.ops} applying={saving} vocabulary={vocab?.vocabulary} names={names} places={places} onSelect={select} onEdit={edit} onOps={addOps} onPlay={playGame} />
                </>)}
            </div>
          </main>
          <PanelResizer side="side" size={layout.side} open={layout.sideOpen} {...resizer} />
          <aside className="studio-side">
            {/* The right column is the file: the open game's game.json edited here, another game's read as JSON. */}
            {gamesShown && pickedGame !== game ? <JsonFile name={`${pickedGame}/game.json`} value={games.find((g) => g.id === pickedGame)?.file} note={tr("打开这款游戏后在这里编辑")} />
              : gamesShown ? sideCtx && <Inspector content={course} vocab={vocab} at={{ game: true }} field={at?.game && field ? field : { path: [] }} ctx={sideCtx} places={places} onEdit={edit} onOps={addOps}
                onPick={(path) => { if (!at?.game) setAt({ game: true }); pickField(path) }} onLevel={() => {}} onRemoveLevel={() => {}} onRemoveSelection={() => setField(null)}
                tabs={[]} selection={{ game: true }} onToggleTab={() => {}} onOpenTab={() => {}} onCloseTab={() => {}}
                onNavigate={(path) => { if (!at?.game) setAt({ game: true }); pickField(path) }} />
              : sideCtx && <Inspector content={course} vocab={vocab} at={openEvent ? { override: { event: openEvent, layer } } : chapterFile ?? { game: true }} field={openEvent ? { path: [] } : packagesShown ? null : field ?? (at?.game || e !== null ? { path: [] } : null)} ctx={sideCtx} places={places} onEdit={edit} onOps={addOps} onPick={pickField}
              onLevel={() => {}} onRemoveLevel={() => {}} onRemoveSelection={() => setField(null)}
              tabs={[]} selection={at?.game ? { game: true } : { era: e }} onToggleTab={() => {}} onOpenTab={() => {}} onCloseTab={() => {}}
              onNavigate={(path) => pickField(path)} />}
          </aside>
          {layout.auditOpen && <PanelResizer side="audit" size={layout.audit} open {...resizer} />}
          <aside className="studio-audit">
            <Drawer open={layout.auditOpen} tab={drawerTab} onTab={openDrawer} onToggle={() => setLayout((l) => ({ ...l, auditOpen: !l.auditOpen }))} sum={auditSum(items, last)} fresh={fresh} ops={ops}
              tabs={['audit', 'changes', 'debug']}
              audit={<Audit items={items} fresh={fresh} last={last} at={null} busy={busy} open={layout.auditOpen && drawerTab === 'audit'} onOpen={() => openDrawer('audit')} onJump={jumpTo} />}
              panel={drawerTab === 'changes' ? <Review ops={ops} redo={redo} result={result} shown={shown} reviewed={pending.reviewed} watch={pending.watchReview} why={why} setWhy={setWhy} said={said}
                onRemove={(k) => { if (confirmDelete(ops[k].op)) pending.remove(k) }} onBack={back} onRedo={again}
                onDiscard={discard} onOpen={pending.open} onApply={apply} onUndo={undo} onSelect={() => {}} />
                : <Debug ops={ops} last={last} />} />
          </aside>
        </div>
      )}
    </div>
  )
}

/** A chapter's own fields copied for a new one: its title "New chapter", its other texts empty, the rest as they were. */
function retitled(value, key = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (isText(value)) return key === 'title' ? T("新的一章") : Object.fromEntries(textEntries(value).map(([lang]) => [lang, '']))
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, retitled(v, k)]))
}

/** The packages, those the game plays first, grouped by kind or source, with search; one picked shows in the middle (PackageCard). */
function UsedPackages({ packages, used, current, onOpen }) {
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const listed = [...packages].sort((a, b) => Number(used.includes(b.id)) - Number(used.includes(a.id)) || a.id.localeCompare(b.id))
    .filter(({ id, title, uses }) => words.every((word) => `${id} ${Object.values(title).join(' ')} ${Object.keys(uses ?? {}).join(' ')}`.toLowerCase().includes(word)))
  return (
    <nav className="parts-list" aria-label={tr("包")}>
      <SidebarGrouping scope="arrange-packages" groupsOf={by => packageSidebarGroups(listed, by)} tools={{ query, onQuery: setQuery }} row={({ id, title, desc }) => (
        <ListRow key={id} icon={Package} title={L(title)} id={id} tooltip={L(desc)} on={id === current}
          className={`is-object ${used.includes(id) ? '' : 'is-unused'}`} onClick={() => onOpen(id)}>
          {used.includes(id) && <i className="project-pick-open">{tr("在用")}</i>}
        </ListRow>
      )} />
    </nav>
  )
}

/**
 * A package picked in the list: whether the game plays it (added, with the dependencies it lacks, or taken out:
 * `onOps(ops)` resolves to the kernel's refusal or null), what it loads on, what it holds; open it to build.
 */
function PackageCard({ id, packages, games, used, labels, pending, onBuild, onOps }) {
  const [refusal, setRefusal] = useState(null)
  const info = packages.find(pkg => pkg.id === id)
  if (!info) return <article className="arrange" />
  const uses = packages.filter(pkg => Object.hasOwn(info.uses, pkg.id))
  const missing = missingDependencies(packages, used, id)
  const missingNames = missing.map((dep) => L(packages.find((pkg) => pkg.id === dep)?.title) ?? dep)
  const run = async (ops) => setRefusal(await onOps(ops))
  const surface = surfaceCounts(info)
  return (
    <article className="editor">
      <header className="editor-head">
        <PackageName info={info} />
        <span className="object-kind">{used.includes(id) ? tr("在用") : tr("未用")}</span>
        <span className="kit-spacer" />
        {used.includes(id)
          ? <button type="button" className="kit-btn is-label" disabled={pending} onClick={() => run(packageRemoveOps(id))}><Minus size={13} aria-hidden="true" />{tr("不再选用")}</button>
          : <button type="button" className="kit-btn is-label" disabled={pending} onClick={() => run(packageAddOps(packages, used, id))}>
            <Plus size={13} aria-hidden="true" />{missing.length ? tr("连同 {value} 一起选用", { value: { zh: missingNames.join('、'), en: missingNames.join(', ') } }) : tr("选用")}
          </button>}
        {onBuild && <button type="button" className="kit-btn is-label" onClick={() => onBuild(id)}><Hammer size={13} aria-hidden="true" />{tr("构建")}</button>}
      </header>
      <p className="package-description">{L(info.desc)}</p>
      {refusal && <p className="is-error package-refusal" role="alert">{refusal}</p>}
      <dl className="package-facts">
        <dt>{tr("种类")}</dt><dd>{info.kind ? <>{packageKindLabel(info.kind)} <code>{info.kind}</code></> : '—'}</dd>
        <dt>{tr("版本")}</dt><dd><code>{info.version ?? '—'}</code></dd>
        {uses.length > 0 && <><dt>{tr("依赖")}</dt><dd><PackageDependencies key={id} packages={uses} /></dd></>}
        <PackageUsers packages={packages} games={games} id={id} />
      </dl>
      {surface.length > 0 && <>
        <h3 className="package-meta-file">{tr("公开内容")}</h3>
        <dl className="package-facts">
          {surface.map(([kind, n]) => <Fragment key={kind}><dt>{surfaceName(kind, labels)}</dt><dd>{n}</dd></Fragment>)}
        </dl>
      </>}
    </article>
  )
}
