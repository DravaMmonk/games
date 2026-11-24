import CopyId from './CopyId.jsx'
import { referenceCatalog } from './reference-catalog.js'
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
import { opFor, placesOf } from './form.js'
import { itemOf } from './worklist.js'
import { usePref } from './prefs.js'
import { confirmDelete } from './delete.js'
import { blankChapter, chapterName, chapterRetitle, chaptersOrder, chapterSet, moveChapter, newChapterName } from './course-edit.js'
import { missingDependencies, packageAddOps, packageRemoveOps } from './game-packages.js'
import { useChangeset } from './useChangeset.js'
import { useAdvisories } from './useAdvisories.js'
import StudioBar from './StudioBar.jsx'
import Loading from './Loading.jsx'
import { mobilePanelProps, useMobilePanels } from './MobilePanels.jsx'
import PanelResizer from './PanelResizer.jsx'
import ChapterBoard from './ChapterBoard.jsx'
import CourseImpact from './CourseImpact.jsx'
import { courseLinks, courseRemoval, courseReorder, singleLevelRemoval } from './course-impact.js'
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
import TitleEdit from './TitleEdit.jsx'
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
export default function GameStudio({ game, games, onGame, onMade, packages = [], onBuild, space, catalog }) {
  const pending = useChangeset(game, SCOPE, { courseAudit: true })
  const { ops, redo, why, setWhy, shown, last, checked, domainVocab, busy, rev, saving, said, fresh, lines, result, edit, addOps, back, again, discard, apply, undo } = pending
  const [rawNames, setRawNames] = useState(null)
  const [at, setAt] = useState(() => (QUERY.get('era') !== null ? { era: Number(QUERY.get('era')) } : { era: 0 }))
  const [drawerTab, setDrawerTab] = usePref('game-drawer-tab', 'audit') // the fold bar's tab (Drawer.jsx)
  const [mobilePanel, showMobilePanel] = useMobilePanels()
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
    showMobilePanel('main')
  }
  const [layout, setLayout] = usePref('game-layout', { tree: 220, audit: 200, side: 360, treeOpen: true, auditOpen: true, sideOpen: true })
  useEffect(() => {
    setRawNames(null)
    setField(null)
  }, [game])
  const content = shown?.content ?? null
  const loaded = Boolean(content)
  // Names for the links in the copy, as the changeset leaves the game.
  const namesSeq = useRef(0)
  const naming = useMemo(() => JSON.stringify((shown?.ops ?? []).filter((op) => op.op !== 'text.override')), [shown?.ops])
  useEffect(() => {
    if (!loaded) return undefined
    const no = ++namesSeq.current
    const timer = window.setTimeout(() => call('names', { game, scope: SCOPE, changeset: { ops: JSON.parse(naming) } }).then((r) => no === namesSeq.current && setRawNames(r)).catch(() => {}), naming === '[]' ? 0 : SETTLE)
    return () => window.clearTimeout(timer)
  }, [game, naming, rev, loaded])
  const vocab = useMemo(() => domainVocab && { ...domainVocab, vocabulary: contentVocabulary(domainVocab.vocabulary, content) }, [domainVocab, content])
  // The course as game.json writes it: the forms and the side panel edit it so.
  const course = useMemo(() => content && { ...content, chapters: content.sourceChapters ?? [] }, [content])
  const names = useMemo(() => referenceCatalog(rawNames), [rawNames])
  const levelOptions = useMemo(() => content?.levels.map((l) => ({ value: l.id, label: l.id, title: l.title })) ?? null, [content])
  const advice = useAdvisories(game)
  const items = useMemo(() => [...lines, ...advice.lines].map(itemOf), [lines, advice.lines])
  const places = useMemo(() => placesOf(lines, checked?.order ?? shown?.order ?? [], vocab?.vocabulary), [lines, checked, shown, vocab])

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
    showMobilePanel('side', true)
  }
  // A chapter is its own object (course-edit.js); the game's `chapters` list orders them.
  const newChapter = () => {
    const name = newChapterName(eras)
    const { id: _, ...fields } = blankChapter(eras, eras.at(-1) ?? {}, (fields) => retitled(fields))
    addOps([{ op: 'chapter.put', chapter: name, data: fields }, chaptersOrder([...eras, { id: `${layer}/${name}` }])])
    select({ era: eras.length })
  }
  const [impact, setImpact] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [impactBusy, setImpactBusy] = useState(false)
  const [impactProblem, setImpactProblem] = useState(null)
  const clearImpact = () => { setImpact(null); setImpactProblem(null); setConfirmation(null) }
  const checkImpact = async () => {
    const plan = confirmation ?? impact
    if (impactBusy || !plan?.run) return
    setImpactBusy(true)
    try {
      const preview = await call('preview', { game, scope: SCOPE, changeset: { ops: [...ops, ...plan.run] },
        check: false, changesOnly: true, omit: ['content', 'changes', 'log', 'drift'] })
      if (!preview.ok) {
        setImpactProblem(preview.problems?.join('\n') || tr("操作失败"))
        return
      }
      plan.beforeAdd?.()
      addOps(plan.run, confirmation ? plan.action : plan.title, { atomic: true })
      plan.after?.()
      clearImpact()
    } catch (error) {
      setImpactProblem(error.message)
    } finally {
      setImpactBusy(false)
    }
  }
  const levelName = (id) => L(content.registries.level[id]?.title) || id
  const removeFromCourse = (k, ids, wholeChapter = false) => {
    if (saving || shown?.ops !== ops || (wholeChapter && eras.length === 1)) return
    const chapter = eras[k]
    const vocabulary = vocab?.vocabulary
    const links = courseLinks(content, vocabulary)
    const plan = courseRemoval(eras, links, ids, wholeChapter ? chapter.id : null)
    if (!plan.ops.length) return
    const formatLevels = (affected, statusOf) => affected.map(({ chapter, ids }) => ({
      title: chapterTitle(chapter), items: ids.map(id => {
        const status = statusOf?.(id)
        return <><code>{id}</code> {levelName(id)}{status && <> · {status}</>}</>
      }),
    }))
    const formatLinks = (edges) => edges.map(({ from, to }) => <>{levelName(from)} → {levelName(to)}</>)
    const afterRemoval = (affected) => {
      if (wholeChapter) select({ era: Math.min(k, eras.length - 2) })
      else if (affected.some(({ ids }) => ids.includes(at?.level))) select({ era: e })
      openDrawer('changes')
    }
    const count = plan.affected.reduce((total, item) => total + item.ids.length, 0)
    const cascade = {
      title: wholeChapter ? tr("删除章节「{name}」", {name: chapterTitle(chapter) || chapterName(chapter.id)}) : tr("确认一并移出后置关卡"),
      message: count ? tr("将从课程移出 {count} 个关卡，含依赖它们的后置关卡。包里的关卡文件会保留。", {count}) : null,
      groups: formatLevels(plan.affected),
      run: plan.ops,
      action: wholeChapter ? tr("删除章节") : tr("全部移出"),
      after: () => afterRemoval(plan.affected),
    }
    if (wholeChapter) {
      setImpact(cascade)
      return
    }

    const [id] = ids
    const single = singleLevelRemoval(content, vocabulary, eras, links, id)
    const blocked = single.blocked.length > 0
    const keep = {
      title: tr("确认仅移出此关"),
      message: blocked
        ? tr("以下后置关卡仍有标签或任务内容要求的依赖。请返回并选择「全部移出」。")
        : tr("只从当前课程移出此关，保留其余关卡和包里的关卡文件。"),
      groups: [...formatLevels(plan.affected, level => level === id ? tr("将移出") : tr("将保留")), ...(blocked || single.disconnected.length ? [{
        title: blocked ? tr("无法单独断开的依赖") : tr("将断开的连线"),
        items: formatLinks(blocked ? single.blocked : single.disconnected),
      }] : [])],
      run: blocked ? null : single.ops,
      action: tr("断开依赖"),
      after: () => afterRemoval(single.affected),
    }
    setImpact({
      title: tr("从课程移出关卡"),
      message: tr("选择如何移出「{name}」。", {name: levelName(id)}),
      groups: formatLevels(plan.affected, level => level === id ? tr("所选关卡") : null),
      choices: count > 1 ? [keep, cascade] : [keep],
    })
  }
  // A chapter's title is edited where it is shown (the list, double-clicked; the board's head), in the studio's language.
  const [renaming, setRenaming] = useState(null)
  const chapterTitle = (chapter) => L(chapter.title ?? chapter.chapter?.title) ?? ''
  const retitle = (k, text) => {
    const op = chapterRetitle(content, layer, eras[k].id, text, getLang())
    if (op) edit(op)
  }
  const reorderCourse = (next, orderOp, after = null) => {
    if (saving || shown?.ops !== ops) return
    const plan = courseReorder(content, vocab?.vocabulary, courseLinks(content, vocab?.vocabulary), eras, next)
    if (!plan.removed.length) {
      addOps([orderOp])
      after?.()
      return
    }
    const blocked = plan.blocked.length > 0
    setImpact({
      title: blocked ? tr("无法调整顺序") : tr("调整顺序并取消依赖"),
      message: blocked
        ? tr("以下先修来自标签或任务内容，课程编排无法自动取消。")
        : tr("调整顺序会取消以下课程先修连线。"),
      groups: [{ items: (blocked ? plan.blocked : plan.removed).map(({ from, to }) => <>{levelName(from)} → {levelName(to)}</>) }],
      run: blocked ? null : [...plan.ops, orderOp],
      action: tr("调整顺序"),
      after,
    })
  }
  const showRouteImpact = (plan, run, beforeAdd) => {
    const blocked = plan.blocked.length > 0
    setImpact({
      title: tr("移动与先修依赖冲突"),
      message: blocked
        ? tr("以下先修来自标签，课程编排无法单独断开。")
        : tr("移动到这一行需要断开以下课程先修连线。"),
      groups: [{ items: (blocked ? plan.blocked : plan.removed).map(({ from, to }) => <>{levelName(from)} → {levelName(to)}</>) }],
      run: blocked ? null : run,
      action: tr("断开依赖并移动"),
      confirmation: !blocked && {
        title: tr("确认断开依赖并移动"),
        message: tr("这些先修连线将从当前课程移除，并与卡片移动一起加入待定修改。"),
      },
      beforeAdd,
    })
  }
  const shift = (k, by) => {
    const next = moveChapter(eras, k, by)
    if (next !== eras) reorderCourse(next, chaptersOrder(next), () => select({ era: k + by }))
  }
  const reorderMembers = (levels) => {
    const next = eras.map((chapter, index) => index === e ? { ...chapter, levels } : chapter)
    reorderCourse(next, chapterSet(eras[e].id, ['levels'], levels))
  }
  // Another game opened from the games list (the pending operations given up, after asking).
  const openGame = (id) => {
    if (id === game || saving) return
    if (ops.length && !window.confirm(tr("换一款游戏会放弃待定操作，确定吗？"))) return
    onGame(id)
    select({ era: 0 })
    showMobilePanel('main', true)
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
    if (!found) {
      // A finding about a level (an advisory) goes to it on its chapter's board.
      const era = content.eras.findIndex(chapter => chapter.levels.some(({ id }) => id === item.levels[0]))
      if (era >= 0) select({ era, level: item.levels[0] })
      return
    }
    const path = parsePath(found[1].replace(/^\./, ''))
    if (path[0] === 'chapters' && Number.isInteger(path[1])) select({ era: path[1] })
    else select({ game: true })
    if (path.length) pickField(path)
  }
  const sideCtx = vocab && content && { vocabulary: vocab.vocabulary, levels: content.levels.map((l) => l.id), names, levelOptions, lang: getLang(), onSetting: () => {}, onSettings: () => {}, onPart: () => {} }
  const style = { '--tree-w': `${layout.treeOpen ? layout.tree : 0}px`, '--audit-h': `${layout.audit}px`, '--side-w': `${layout.sideOpen ? layout.side : 0}px` }
  // ⌘/Ctrl+Enter plays the level picked (else the game, from its map), as the build workspace plays a level.
  useWorkspaceKeys((event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter' || !content) return
    event.preventDefault()
    playGame(at?.level ?? null)
  })
  const ready = content && vocab
  const busyEditing = saving || shown?.ops !== ops
  return (
    <div className="studio">
      <StudioBar space={space} ops={ops} catalog={catalog} busy={busy || !fresh} onUndo={ops.length ? () => back(ops.length - 1) : null} onRedo={redo.length ? again : null} panels={{ tree: layout.treeOpen, side: layout.sideOpen, onToggle: (which) => setLayout((l) => ({ ...l, [`${which}Open`]: !l[`${which}Open`] })) }}
        mobilePanels={ready && { panel: mobilePanel, onChange: showMobilePanel }}>
        <button type="button" className={`studio-open-name ${gamesShown ? 'is-on' : ''}`} onClick={() => { setSide('games'); showMobilePanel('tree', true) }} title={tr("选择游戏")}>
          <Gamepad2 size={13} aria-hidden="true" /><span>{L(games.find((g) => g.id === game)?.title) ?? game}</span>
        </button>
        <button type="button" className={`studio-open-name studio-play-toggle ${playing ? 'is-on' : ''}`} aria-pressed={playing}
          onClick={() => { if (playOpened) { setPlaying(!playing); showMobilePanel('main') } else playGame() }} title={`${playing ? tr("回到编排") : tr("试玩这款游戏")} (${MOD}+Enter)`}>
          <Play size={13} aria-hidden="true" /><span>{tr("试玩")}</span>
        </button>
      </StudioBar>
      {impact && <CourseImpact plan={impact} busy={impactBusy} problem={confirmation ? null : impactProblem} onClose={clearImpact}
        onChoose={setConfirmation}
        onConfirm={impact.confirmation ? () => setConfirmation({ ...impact, ...impact.confirmation }) : checkImpact} />}
      {confirmation && <CourseImpact plan={confirmation} busy={impactBusy} problem={impactProblem} closeLabel={tr("返回")} onConfirm={checkImpact}
        onClose={() => { setConfirmation(null); setImpactProblem(null) }} />}
      {!ready ? <Loading label={tr('正在加载课程……')} /> : (
        <div className={`studio-body is-${overridesShown || packagesShown ? 'objects' : 'arrange'} ${layout.treeOpen ? '' : 'no-tree'} ${layout.auditOpen ? '' : 'no-audit'} ${layout.sideOpen ? '' : 'no-side'}`} style={style} data-mobile-panel={mobilePanel}>
          <aside className="studio-tree" {...mobilePanelProps('tree')}>
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
            {gamesShown ? <GameList games={games} current={game} picked={pickedGame} disabled={saving} onPick={(id) => { setPickedGame(id); showMobilePanel('main', true) }} onOpen={openGame} onCreate={makeGame} />
              : packagesShown ? <UsedPackages packages={packages} used={used} current={packageShown} onOpen={(id) => { setPackageAt(id); showMobilePanel('main', true) }} />
              : overridesShown ? <OverrideList events={events} layer={layer} current={openEvent && overrideKey(openEvent)} onOpen={(id) => { setOpenOverride(id); showMobilePanel('main', true) }} /> : (
            <nav className="tree chapters" aria-label={tr("章节")}>
              <SidebarListTools addOptions={busyEditing ? [] : [{ value: 'chapter', label: tr("新的一章") }]} addLabel={tr("新的一章")} onAdd={newChapter}
                query={chapterQuery} onQuery={setChapterQuery} />
              {eras.map((chapter, k) => !chapterMatches(chapter) ? null : (
                <div key={k} className={`chapter-item ${e === k && !at?.game ? 'is-on' : ''}`}>
                  {renaming === k
                    ? <TitleEdit className="chapter-rename" value={chapterTitle(chapter)} label={tr("章名")} autoFocus disabled={busyEditing} onSet={(text) => retitle(k, text)} onDone={() => setRenaming(null)} />
                    : <ListRow icon={BookMarked} on={e === k && !at?.game} onClick={() => { select({ era: k }); showMobilePanel('main', true) }} onDoubleClick={() => !busyEditing && setRenaming(k)}
                      title={chapterTitle(chapter)} id={chapterName(chapter.id)} tooltip={`${chapterTitle(chapter)} · ${chapterName(chapter.id)} · ${tr("双击改章名")}`} />}
                  <span className="chapter-tools">
                    {[[-1, ArrowUp, tr("上移"), k === 0], [1, ArrowDown, tr("下移"), k === eras.length - 1]].map(([by, Icon, label, edge]) => {
                      return <button key={by} type="button" className="kit-btn editor-tool" disabled={busyEditing || edge} onClick={() => shift(k, by)}
                        title={label} aria-label={label}><Icon size={12} /></button>
                    })}
                    <button type="button" className="kit-btn editor-tool" disabled={busyEditing || eras.length === 1} onClick={() => removeFromCourse(k, chapter.levels, true)} title={eras.length === 1 ? tr("课程至少保留一章") : tr("删除章节")}><Trash2 size={12} /></button>
                  </span>
                </div>
              ))}
            </nav>)}
          </aside>
          <PanelResizer side="tree" size={layout.tree} open={layout.treeOpen} setLayout={setLayout} />
          <main className="studio-main" {...mobilePanelProps('main')}>
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
                ? <article className="editor"><header className="editor-head"><h1><TitleEdit value={L(content.title) ?? ''} label={tr("游戏名")} disabled={busyEditing}
                  onSet={(text) => edit(opFor({ game: true }, ['title'], { set: text, ...(typeof content.title !== 'string' && { lang: getLang() }) }, 'text'))} /></h1></header></article>
                : <>
                  <header className="editor-head chapter-head" onClick={(event) => { if (!event.target.closest('button')) pickField([]) }}>
                    <code className="editor-id is-static">{chapterName(eras[e].id)}</code>
                    <CopyId id={eras[e].id} />
                    <h1><TitleEdit value={chapterTitle(eras[e])} label={tr("章名")} disabled={busyEditing} onSet={(text) => retitle(e, text)} /></h1>
                  </header>
                  <ChapterBoard content={content} course={course} e={e} at={at} pending={busyEditing} ops={ops} previewOps={shown?.ops} revision={rev} applying={saving} vocabulary={vocab?.vocabulary} names={names} places={places} onSelect={select} onEdit={edit} onOps={addOps} onPlay={playGame} onReorderLevels={reorderMembers} onRouteImpact={showRouteImpact} onRemoveLevel={(level) => removeFromCourse(e, [level])} />
                </>)}
            </div>
          </main>
          <PanelResizer side="side" size={layout.side} open={layout.sideOpen} setLayout={setLayout} />
          <aside className="studio-side" {...mobilePanelProps('side')}>
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
          {layout.auditOpen && <PanelResizer side="audit" size={layout.audit} open setLayout={setLayout} />}
          <aside className="studio-audit">
            <Drawer open={layout.auditOpen} tab={drawerTab} onTab={openDrawer} onToggle={() => setLayout((l) => ({ ...l, auditOpen: !l.auditOpen }))} sum={auditSum(items, last)} fresh={fresh} ops={ops}
              tabs={['audit', 'changes', 'debug']}
              audit={<Audit chapters={content.eras} items={items} fresh={fresh} last={last} at={null} busy={busy} open={layout.auditOpen && drawerTab === 'audit'} onOpen={() => openDrawer('audit')} onJump={jumpTo} advice={advice} />}
              panel={drawerTab === 'changes' ? <Review showRemovedLevels ops={ops} redo={redo} result={result} shown={shown} reviewed={pending.reviewed} watch={pending.watchReview} why={why} setWhy={setWhy} said={said}
                onRemove={(k) => {
                  const confirmed = pending.grouped(ops[k]) ? window.confirm(tr("确定放弃这组编排操作吗？")) : confirmDelete(ops[k].op)
                  if (confirmed) pending.remove(k)
                }} onBack={back} onRedo={again}
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
