import { T as catalogText } from 'kernel/words'
import { withReadCache } from '../read-cache.js'
import { BUILTIN_POLICIES } from '../kind-policy.js'
import { tagName } from '../tag-identity.js'
import { packageLevel, packageLevelOrder } from '../package-play.js'
import { runtimeIds } from '../runtime.js'
// What an agent can do to a game, as functions of plain data: the tools the MCP server (mcp.js) offers, each a thin
// layer over the kernel (the checks, the operation set, the dependency graph, the vocabulary). None has logic of its
// own: a change is always a changeset (changeset.js). params: each argument's JSON type, '?' when it may be left out.
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { find, shapeAt } from '../schema.js'
import { describe } from '../vocabulary.js'
import { checkGame } from '../checks.js'
import { checkCache } from '../check-cache.js'
import { catalogReader } from '../catalogs.js'
import { packageWords } from '../manifests.js'
import { visibleOverrides } from '../layers.js'
import { workspaceCheckCache, contentRoot, runtimeOf, isDataGame, readContent, readPackage, packageIds, resolveLayers, layerVocabulary, contentTargets, packageDirectory } from '../resolver.js'
import { gameOnPackage, newPackage } from '../scaffold.js'
import { gameOf } from '../games.mjs'
import { contentSchemas } from '../content.js'
import { meaningsOf } from '../kind-meanings.js'
import { fresh } from '../../shell/progress.js'
import { taskContext } from '../../shell/played-task.js'
import { drawDeps } from '../deps.js'
import { getAt, parsePath, showPath } from './edit.js'
import { objectOf, courseRoute } from '../objects.js'
import { operationsFor } from './operations.js'
import { openGame, openPackage } from './workspace.js'
import { adopt, lastUndoable, readLog, runChangeset, undo } from './changeset.js'
import { driftOf, headOf } from './log.js'
import { replaceOps, searchContent } from './search.js'

/** The arguments a call to `tool` lacks. */
export const lacking = (tool, args) => [
  ...Object.entries(tool.params).filter(([k, spec]) => !spec.endsWith('?') && args?.[k] === undefined).map(([k]) => k),
  ...(tool.params.package && !args?.game && !args?.package ? ['game or package'] : []),
]

// The tools use the repository layout, or a copy with games/ and packages/ under GAMES_ROOT.
const ROOT = contentRoot()
// The repository's games keep their checks between calls (../check-cache.js); a copy of them (GAMES_ROOT) is checked afresh.
const kept = (id) => (!workspaceCheckCache() || typeof id === 'object' ? null : checkCache(id))
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
// A game the studio's game workspace makes is known at once: it is read off the folder, not off the list loaded at start.
const dataGames = () => contentTargets([], ROOT, { game: true }).map(target => target.id)
const known = (game) => {
  if (typeof game === 'object' && game.package) {
    if (game.package !== 'kernel' && !packageIds(ROOT).includes(game.package)) throw new Error(`no package ${game.package}`)
    return game
  }
  if (!isDataGame(game, ROOT)) throw new Error(`no game ${game}; the games are ${dataGames().join(', ')}`)
  return game
}
const levelIn = (content, level) => content.levels.find((l) => l.id === level) ?? (() => { throw new Error(`${content.id} has no level ${level}`) })()
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The lines of a check that are about one level (its id first, then a space, a colon or a slash). */
const about = (lines, level) => lines.filter((l) => new RegExp(`^${escape(level)}[ :/]`).test(l.text))

/**
 * The levels a line of the check is about (`ids`: the levels in play order, as the check's paths count them): the
 * level a domain names, the level file a content problem is in, the level a copy problem's path counts to, the level
 * a blind-play report is on, the levels a course finding lists (`object (level)`), or the level the line starts with.
 */
export function levelsOfLine(line, ids) {
  if (line.level) return [line.level]
  const { text } = line
  const file = /^content: levels\/(.+?)\.json/.exec(text)
  if (file) return [file[1]]
  const copy = /^text levels\.(\d+)\b/.exec(text)
  if (copy) return ids[Number(copy[1])] ? [ids[Number(copy[1])]] : []
  const report = /^REPORT [\w-]+: (\S+) /.exec(text)
  if (report) return ids.includes(report[1]) ? [report[1]] : []
  if (/^(OPEN )?course: /.test(text)) return [...new Set([...text.matchAll(/\(([^\s,)]+)\)/g)].map((m) => m[1]).filter((id) => ids.includes(id)))]
  const head = [...ids].sort((a, b) => b.length - a.length).find((id) => new RegExp(`^${escape(id)}[ :/]`).test(text))
  return head ? [head] : []
}

/** A game opened under ROOT: its log, the seq of its last entry (what modify's base names), the change undo would undo next, and the files changed outside the log. */
const logOf = (game, scope, layer, ws = open(game, scope, layer), omit = []) => {
  return { log: omit.includes('log') ? undefined : readLog(ws), head: headOf(ws), undoable: lastUndoable(ws)?.seq ?? null, drift: omit.includes('drift') ? undefined : driftOf(ws, ws.onDisk()) }
}

// A game target edits its game layer. A package target reads objects and edits only its package layer.
const SCOPES = ['package', 'game']
const scoped = (scope) => {
  if (scope !== undefined && !SCOPES.includes(scope)) throw new Error(`scope is ${SCOPES.join(' or ')}, not ${scope}`)
  return scope ?? null
}
const open = (game, scope, layer) => {
  const selected = scoped(scope)
  if (typeof known(game) !== 'object') return openGame(game, ROOT, { scope: selected, layer })
  if (selected === 'game') throw new Error('a package target uses the package workspace')
  return openPackage(game.package, ROOT, { layer })
}
const readTarget = (game) => typeof known(game) === 'object' ? (game.package === 'kernel' ? openPackage('kernel', ROOT).content() : readPackage(game.package, ROOT)) : readContent(game, ROOT)
const readAs = (game, scope) => scoped(scope) === 'package' ? open(game, scope).content() : readTarget(game)

/** A game's content as a changeset would leave it (nothing written; an operation that fails throws its problem). */
async function contentAfter(game, changeset, scope, layer) {
  if (!changeset && !layer) return readAs(game, scope)
  const r = await runChangeset(open(game, scope, layer), changeset ?? { ops: [] }, { write: false, check: false })
  if (!r.content) throw new Error(r.problems.join('; '))
  return r.content
}

/** The board at a content path and the task whose rules it uses. */
function boardAt(content, level, path, vocabulary) {
  const value = levelIn(content, level)
  const keys = parsePath(path)
  if (shapeAt(vocabulary.level, value, keys, { vocabulary })?.type !== 'board') return null
  const lines = getAt(value, keys)
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'string')) return null
  return { lines, task: keys[0] === 'tasks' ? Number(keys[1]) : 0 }
}

/** Every board (blueprint text) a level holds: [{ path, text }]. */
async function boardsOf(content, level) {
  const { vocabulary } = await runtimeOf(content)
  const { id: _, ...value } = levelIn(content, level)
  return find(vocabulary.level, value, 'board', { vocabulary }).map((b) => ({ path: showPath(b.path), text: b.value.join('\n') }))
}

const tools = {
  packages: {
    about: catalogText("列出已安装的包和直接依赖，包括没有游戏的库。"),
    params: {},
    async run() {
      return Promise.all(packageIds(ROOT).map(async (id) => {
        const resolved = resolveLayers({ package: id, closure: true, root: ROOT })
        const layer = resolved.layers.find(layer => layer.id === id)
        return { id, ...layer.config, ...packageWords(layer), source: layer.source, manifest: layer.manifest, lock: resolved.lock, lockStatus: resolved.lockStatus }
      }))
    },
  },
  package_compatibility: {
    about: catalogText("比较包与上次发布的公开面、候选版本及受影响的下游包和游戏。一次检查一个包。"),
    params: { package: 'string' },
    async run({ package: id }) {
      const { packageCompatibility } = await import('../releases.js')
      return packageCompatibility(id, ROOT)
    },
  },
  overrides: {
    about: catalogText("列出这一层可见的覆盖、对象类型、全名、作者和前后值。可预览待应用的变更集。"),
    params: { game: 'string', layer: 'string?', changeset: 'object?' },
    async run({ game, layer, changeset = null }) {
      const content = await contentAfter(game, changeset, null, layer)
      return { overrides: visibleOverrides(content, layer), sources: content.sources }
    },
  },
  objects: {
    about: catalogText("读取登记的标签、关系或分组和展开后的课程路线。可预览待应用的变更集。"),
    params: { game: 'string', kind: 'string?', name: 'string?', member: 'string?', changeset: 'object?', scope: 'string?' },
    async run({ game, kind, name, member, changeset = null, scope }) {
      const content = await contentAfter(game, changeset, scope)
      if (kind && !Object.hasOwn(content.registries, kind)) throw new Error(`unknown object kind ${kind}`)
      return { objects: name ? objectOf(content, kind, name, member) : kind ? content.registries[kind] : content.registries, route: courseRoute(content) }
    },
  },
  games: {
    about: catalogText("列出数据游戏的 id、标题和所用的内容包。多个游戏可以共用一个包。"),
    params: {},
    async run() {
      return dataGames().map((id) => {
        const resolved = resolveLayers({ game: id, root: ROOT })
        const content = readContent(id, ROOT, { resolution: resolved })
        return { id, title: content.title, package: resolved.packageId, kernel: resolved.game.kernel, packages: resolved.packageRanges, lock: resolved.lock, lockStatus: resolved.lockStatus }
      })
    },
  },
  create_game: {
    about: catalogText("沿用 `from` 所用内容包和课程设置，创建独立的游戏目录，并按第一章建立一个空章。新游戏在首页标记为开发中且隐藏。"),
    params: { id: 'string', from: 'string', title: 'object' },
    async run({ id, from, title }) {
      gameOnPackage({ root: ROOT, id, from: known(from), title })
      return { id, ...logOf(id) }
    },
  },
  create_package: {
    about: catalogText("从已装包复制文件并重写本包名字，或用 `empty` 创建空包。写入依赖锁。kind 省略时沿用来源的类别。"),
    params: { id: 'string', kind: 'string?', from: 'string?', empty: 'boolean?' },
    async run({ id, kind, from, empty = false }) {
      const sourceKind = !kind && from && existsSync(resolve(packageDirectory(from, ROOT), 'package.json')) ? JSON.parse(readFileSync(resolve(packageDirectory(from, ROOT), 'package.json'), 'utf8')).kind : undefined
      newPackage({ root: ROOT, id, kind: kind ?? sourceKind, from, empty })
      return { id }
    },
  },
  audit: {
    about: catalogText("运行 npm run check 的内容、课程、文案和玩法检查。mutants 可请求已支持的玩法报告参考解变异覆盖。"),
    params: { game: 'string', mutants: 'boolean?' },
    async run({ game, mutants = false }) {
      const content = readTarget(game)
      const lines = await checkGame(content, { domain: await runtimeOf(content), mutants, cache: kept(game), root: ROOT })
      return { ok: !lines.some((l) => l.fail), failures: lines.filter((l) => l.fail).map((l) => l.text), lines: lines.map((l) => `${l.fail ? 'FAIL ' : ''}${l.text}`) }
    },
  },
  modify: {
    about: catalogText("逐项执行变更集并检查整个目标。全部通过才写入，dryRun 只预览。base 是调用者看到的最后日志序号，过期时拒绝。by 会写进日志，操作和参数见 vocabulary。"),
    params: { game: 'string', changeset: 'object', dryRun: 'boolean?', base: 'number?', scope: 'string?', layer: 'string?' },
    async run({ game, changeset, dryRun = false, base = null, scope, layer }) {
      const r = await runChangeset(open(game, scope, layer), changeset, { write: !dryRun, base, cache: kept(game) })
      return { ok: r.ok, written: r.ok && !dryRun, says: r.says, problems: r.problems, files: r.files, diff: r.diff, undo: r.inverse }
    },
  },
  run_reference: {
    about: catalogText("用玩法检查跑参考解和直觉错解，返回该关的检查输出和通过状态。"),
    params: { game: 'string', level: 'string' },
    async run({ game, level }) {
      const source = readTarget(game)
      const content = source.packageTarget ? packageLevel(source, level) : source
      levelIn(content, level)
      const domain = await runtimeOf(content)
      const lines = await domain.validate(domain.spec(content))
      const mine = about(lines, level)
      return { ok: !mine.some((l) => l.fail), lines: mine.map((l) => `${l.fail ? 'FAIL ' : ''}${l.text}`), ...(mine.length ? {} : { note: 'no line names this level: this domain reports a level only when it fails' }) }
    },
  },
  blueprint: {
    about: catalogText("以蓝图文本读取关卡的作品。给 text 时，通过 level.blueprint 写入 path 指定的作品，默认是 solution。dryRun 只预览。"),
    params: { game: 'string', level: 'string', path: 'string?', text: 'string?', dryRun: 'boolean?' },
    async run({ game, level, path, text, dryRun = false }) {
      if (text === undefined) {
        const boards = await boardsOf(readTarget(game), level)
        return path === undefined ? { boards } : boards.find((b) => b.path === showPath(parsePath(path))) ?? { note: `${level} has no board at ${path}`, boards: boards.map((b) => b.path) }
      }
      return TOOLS.modify.run({ game, dryRun, changeset: { ops: [{ op: 'level.blueprint', level, ...(path !== undefined && { path }), text }] } })
    },
  },
  render: {
    about: catalogText("以文本呈现关卡给出的材料、任务和作品蓝图。format 为 svg 时调用已登记的作品绘制器。changeset 用于预览。"),
    params: { game: 'string', level: 'string', path: 'string?', format: 'string?', changeset: 'object?' },
    async run({ game, level, path, format = 'text', changeset = null }) {
      if (format !== 'text' && format !== 'svg') return { rendered: false, note: `${format}: only text and svg are drawn headlessly; for a picture of the level as played, build the game (npm run build:games) and open it.` }
      const content = await contentAfter(game, changeset)
      const value = levelIn(content, level)
      const boards = await boardsOf(content, level)
      if (format === 'svg') {
        if (path !== undefined) {
          const board = boards.find((b) => b.path === showPath(parsePath(path)))
          return board ? { svg: renderWork(content, board.text, `${level} ${board.path}`) } : { note: `${level} has no board at ${path}`, boards: boards.map((b) => b.path) }
        }
        return { boards: boards.map((b) => ({ path: b.path, svg: renderWork(content, b.text, `${level} ${b.path}`) })) }
      }
      if (path !== undefined) {
        const board = boards.find((b) => b.path === showPath(parsePath(path)))
        return board ? { text: board.text } : { text: JSON.stringify(getAt(value, path), null, 2) }
      }
      const pick = (v) => (v && typeof v === 'object' && 'en' in v ? v.en : v)
      // What sort of level it is: its fields that pick one of a few (its kind or mode, its world, its robot…), by its schema.
      const { vocabulary } = await runtimeOf(content)
      const shape = shapeAt(vocabulary.level, value, [], { vocabulary })
      const picks = Object.entries(shape?.fields ?? {}).filter(([k, s]) => ['oneOf', 'ref'].includes(s.type) && value[k] !== undefined).map(([k]) => k)
      const rows = [
        `${level} · ${pick(value.title)}`,
        ...picks.map((k) => `${k}: ${JSON.stringify(value[k])}`),
        ...(value.brief ? [`brief: ${pick(value.brief)}`] : []),
        ...meaningsOf(contentSchemas.get(content)).flatMap(meaning => meaning.renderFields?.({ value }) ?? []),
        ...(value.tests ? [`tests: ${JSON.stringify(value.tests).slice(0, 600)}`] : []),
        ...value.tasks.map((task, k) => `task ${k + 1} (${task.id}): ${pick(task.step) ?? ''} ${task.brief ? `— ${pick(task.brief)}` : ''}`),
        ...boards.flatMap((b) => ['', `${b.path}:`, ...b.text.split('\n').map((l) => `  ${l}`)]),
      ]
      return { text: rows.join('\n') }
    },
  },
  deps: {
    about: catalogText("由已加载的对象类型提供依赖图，输出 Mermaid 或 DOT。"),
    params: { game: 'string', dot: 'boolean?', levels: 'boolean?' },
    async run({ game, dot = false, levels = false }) {
      const content = readTarget(game)
      if (content.packageTarget) throw new Error('a package has no course dependency graph; read its relations with objects')
      return { text: await drawDeps(content, { dot, levels }) }
    },
  },
  play_level: {
    about: catalogText("独立打开包的一关，返回 GameFrame 所用的运行内容，跳过章、先修和进度。"),
    params: { package: 'string', level: 'string', changeset: 'object?' },
    async run({ package: id, level, changeset = null }) {
      const source = await contentAfter({ package: id }, changeset)
      return { content: packageLevel(source, level) }
    },
  },
  preview: {
    about: catalogText("预览变更后的内容、检查输出、文件前后文本、失败的操作及日志。check 为 false 时只做词汇表检查。omit 可省略 changes、log、drift 或 content。"),
    params: { game: 'string', changeset: 'object?', check: 'boolean?', scope: 'string?', layer: 'string?', omit: 'array?' },
    async run({ game, changeset = { ops: [] }, check = true, scope, layer, omit = [] }) {
      const ws = open(game, scope, layer)
      const r = await runChangeset(ws, changeset, { write: false, check, cache: kept(game), texts: !omit.includes('changes') })
      const { content } = r
      // Copy problems count levels in play order, which only a content that fits its vocabulary has (and only the whole
      // check reports them: a quick preview does without the order).
      const ids = !content ? [] : content.packageTarget ? packageLevelOrder(content) : !check || r.lines.some((l) => l.text.startsWith('content: ')) ? content.levels.map((l) => l.id) : (await runtimeOf(content)).spec(content).levels.map((l) => l.id)
      const answer = {
        ok: r.ok, says: r.says, problems: r.problems, failed: r.failed, content, order: ids,
        lines: r.lines.map((l) => ({ ...l, levels: levelsOfLine(l, ids) })),
        changes: r.changes, ...logOf(game, scope, layer, ws, omit),
      }
      // A caller that has no use for some of the answer (the studio's quick preview: the file texts and the log) leaves it out.
      for (const key of omit) delete answer[key]
      return answer
    },
  },
  names: {
    about: catalogText("读取游戏引用和已登记对象类型的显示名称、标题和标签，供文案引用。"),
    params: { game: 'string', changeset: 'object?', scope: 'string?' },
    async run({ game, changeset = null, scope }) {
      const content = await contentAfter(game, changeset, scope)
      const tags = Object.entries(content.registries.tag).map(([key, tag]) => ({ key, name: tagName(key), member: tag.kind }))
      if (content.packageTarget) return {
        tags,
        levels: packageLevelOrder(content).map(id => ({ id, label: id, title: levelIn(content, id).title })),
        ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.namesForTool?.({ content }))),
        entries: (content.glossary?.entries ?? []).map((e) => ({ id: e.id, title: e.title })),
      }
      const shown = await gameOf(content)
      return {
        tags,
        levels: shown.levels.map((l) => ({ id: l.id, label: String(shown.levelLabel(l)), title: l.title })),
        ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.namesForTool?.({ content, game: shown }))),
        entries: (shown.glossary?.entries ?? []).map((e) => ({ id: e.id, title: e.title })),
      }
    },
  },
  run_tests: {
    about: catalogText("按玩法界面实际运行方式，用可见和隐藏测试跑作品。path 默认选第一个任务的参考解。返回每组的输入、预期、通过状态和反馈。"),
    params: { game: 'string', level: 'string', path: 'string?', changeset: 'object?', scope: 'string?' },
    async run({ game, level, path = 'tasks[0].solution', changeset = null, scope }) {
      const source = await contentAfter(game, changeset, scope)
      const content = source.packageTarget ? packageLevel(source, level) : source
      const domain = await runtimeOf(content)
      if (!domain.play) return { covered: false, why: 'the selected runtime gives no play hook' }
      const board = boardAt(content, level, path, domain.vocabulary)
      if (!board) return { covered: false, why: `${level} has no board at ${path}` }
      const { lines, task } = board
      const shown = await gameOf(content)
      const at = shown.byId[level]
      // The Studio preview opens all progression gates.
      const progress = { ...fresh(), all: true }
      const ctx = taskContext(shown, progress, at, task)
      // A hook that cannot open the level without the boards a played session would have built says so.
      let opened
      let r
      try {
        opened = domain.play.open(ctx)
        if (opened.covered === false) return { covered: false, why: opened.why }
        r = domain.play.attempt(ctx, lines.join('\n'))
      } catch (error) {
        return { covered: false, why: `the play hook fails on this level outside a session: ${error.message}` }
      }
      return {
        covered: true, task, pass: Boolean(r.pass), refused: r.refused ?? null, says: r.says ?? [], hidden: r.hidden ?? null,
        tests: (opened.tests ?? []).map((t, k) => ({ label: t.label, shows: t.text, pass: r.tests?.[k]?.pass ?? null, says: r.tests?.[k]?.says ?? null })),
      }
    },
  },
  seed: {
    about: catalogText("取得一件作品在当前界面中的存档表示。写入 progress.data 的对应任务 id 可从该作品打开关卡。task 是任务索引。"),
    params: { game: 'string', level: 'string', path: 'string?', changeset: 'object?', scope: 'string?' },
    async run({ game, level, path = 'tasks[0].solution', changeset = null, scope }) {
      const source = await contentAfter(game, changeset, scope)
      const content = source.packageTarget ? packageLevel(source, level) : source
      const domain = await runtimeOf(content)
      const board = boardAt(content, level, path, domain.vocabulary)
      if (!board) return { note: `${level} has no board at ${path}` }
      const { lines, task } = board
      const blueprint = domain.spec(content).blueprints?.find((entry) => entry.level === level && entry.task === task)
      if (!blueprint) return { note: `${level} task ${task + 1} has no blueprint reader` }
      try {
        return { data: blueprint.read(lines), task }
      } catch (error) {
        throw new Error(`${level} ${path}: ${error.en ?? error.message}`, { cause: error })
      }
    },
  },
  search: {
    about: catalogText("按游玩顺序搜索文案、蓝图和关卡或词条 id。返回文件、关卡、路径和匹配区间。可预览变更集。"),
    params: { game: 'string', query: 'object', changeset: 'object?', scope: 'string?' },
    async run({ game, query, changeset = null, scope }) {
      const content = await contentAfter(game, changeset, scope)
      const hits = searchContent(content, (await runtimeOf(content)).vocabulary, query)
      return { count: hits.length, hits }
    },
  },
  replace: {
    about: catalogText("为匹配生成 text.set 或 level.blueprint 操作和前后文本。正则分组用 $1 等，pick 可限定命中。返回涉及的 id。用 modify 预览或写入。"),
    params: { game: 'string', query: 'object', with: 'string', pick: 'array?', changeset: 'object?', scope: 'string?' },
    async run({ game, query, with: replacement, pick = null, changeset = null, scope }) {
      const content = await contentAfter(game, changeset, scope)
      const { ops, changes, skipped } = replaceOps(content, (await runtimeOf(content)).vocabulary, query, replacement, pick)
      return { changeset: { why: `replace ${JSON.stringify(query.find)} with ${JSON.stringify(replacement)}`, ops }, changes, skipped: skipped.map((h) => ({ file: h.file, path: showPath(h.path), text: h.text })) }
    },
  },
  history: {
    about: catalogText("读取 Git 中指定版本的课程或包文件。版本默认 HEAD，路径可用关卡 id 或相对文件名。"),
    params: { game: 'string', level: 'string?', file: 'string?', rev: 'string?' },
    async run({ game, level, file, rev = 'HEAD' }) {
      const ws = open(game)
      const name = level !== undefined ? `levels/${level.replace(`${ws.packageId}/`, '')}.json` : file ?? (ws.packaged ? 'package.json' : 'game.json')
      const fileName = relative(ws.dir, resolve(ws.dir, name))
      if (fileName.startsWith('..')) throw new Error(`${name} is outside ${game}`)
      const path = ws.pathFor(fileName)
      try {
        const tree = git('rev-parse', '--verify', '--end-of-options', `${rev}^{tree}`).trim()
        const text = git('show', `${tree}:${path}`)
        if (!name.endsWith('.json')) return { found: true, rev, file: name, text }
        let value = JSON.parse(text)
        const isObject = Object.values(ws.kindFolders).some(folder => fileName.startsWith(`${folder}/`))
        if (isObject || ['game.json', 'blueprint.json'].includes(fileName)) {
          const scope = join(isObject ? path.slice(0, -fileName.length) : dirname(path), 'i18n')
          const files = git('ls-tree', '-r', '--name-only', '-z', tree, '--', `${scope}/`).split('\0').filter((file) => file.endsWith('.json'))
          const catalogs = Object.fromEntries(files.map((file) => [file.slice(scope.length + 1, -'.json'.length), JSON.parse(git('show', `${tree}:${file}`))]))
          value = catalogReader(catalogs, scope)(value, path)
        }
        return { found: true, rev, file: name, text, value }
      } catch (error) {
        return { found: false, rev, file: name, why: String(error.stderr ?? error.message).trim().split('\n')[0] }
      }
    },
  },
  log: {
    about: catalogText("按时间从早到晚读取日志，并给出下一次 undo 将撤销的变更。"),
    params: { game: 'string' },
    async run({ game }) {
      return logOf(game)
    },
  },
  adopt: {
    about: catalogText("把在操作集之外修改的文件纳入日志并更新漂移记录。此条记录成为撤销边界。"),
    params: { game: 'string', why: 'string' },
    async run({ game, why }) {
      const ws = open(game)
      return { seq: adopt(ws, why), ...logOf(game) }
    },
  },
  undo: {
    about: catalogText("逆向执行最后一条仍可撤销的变更并登记日志。dryRun 只预览。seq 已过期时拒绝。"),
    params: { game: 'string', dryRun: 'boolean?', seq: 'number?' },
    async run({ game, dryRun = false, seq = null }) {
      const r = await undo(open(game), { write: !dryRun, seq })
      return { ok: r.ok, written: r.ok && !dryRun, says: r.says, problems: r.problems, files: r.files, diff: r.diff }
    },
  },
  vocabulary: {
    about: catalogText("读取内容词汇表、命名形状、玩法字段和操作参数。"),
    params: { game: 'string' },
    async run({ game }) {
      const content = readTarget(game)
      const vocabulary = contentSchemas.get(content)
      return {
        modules: runtimeIds(content),
        // Package declarations and their projected public vocabulary drive authoring.
        packageCode: Boolean(vocabulary.packageCode),
        layerOrder: content.layerOrder,
        shapeDeclarations: content.registries.shape ?? {},
        capabilityDeclarations: content.capabilityDeclarations ?? {},
        objectKinds: vocabulary.objectKinds ?? {},
        kindDeclarations: Object.fromEntries(Object.keys(vocabulary.objectKinds ?? {}).map(name => [name, content.registries.kind[name]])),
        kindPolicies: Object.fromEntries(Object.entries({ ...BUILTIN_POLICIES, ...vocabulary.objectKinds }).map(([name, { declares, overrides, variants }]) => [name, { declares, overrides, ...(variants && { variants }) }])),
        vocabulary: describe({ ...vocabulary, objectKinds: undefined, kindPolicies: undefined }),
        operations: Object.fromEntries(Object.entries(operationsFor(vocabulary)).map(([name, op]) => [name, { about: op.about, params: op.params }])),
      }
    },
  },
}


// Headless plugin play never loads a view or discloses authored reference/wrong answers.
tools.play_task = {
  about: catalogText("通过已登记的盲玩代理观察任务或提交作品。"),
  params: { game: 'string', level: 'string', task: 'string?', work: 'any?' },
  async run({ game, level: name, task: key, work }) {
    const content = await contentAfter(game)
    const level = content.levels.find(level => level.id === name)
    if (!level) throw new Error(`unknown level ${name}`)
    const task = key ? level.tasks.find(task => task.id === key) : level.tasks[0]
    if (!task) throw new Error(`unknown task ${key}`)
    const runtime = await runtimeOf(content)
    const context = { content, level: { source: { ...level, ...task, taskId: task.id } }, progress: { passed: [] } }
    return work === undefined ? runtime.play.open(context) : runtime.play.attempt(context, work)
  },
}

/** The same tools accept exactly one explicit target. Package calls share no game state or game log. */
const toolMeanings = withReadCache(ROOT, () => layerVocabulary(resolveLayers({ packages: packageIds(ROOT), closure: true, root: ROOT, unlocked: true }).layers).meanings)
for (const meaning of toolMeanings) for (const [name, tool] of Object.entries(meaning.tools ?? {})) tools[name] = { ...tool, run: args => tool.run(args, { contentAfter, runtimeOf }) }

export const TOOLS = Object.fromEntries(Object.entries(tools).map(([name, original]) => {
  const tool = ['preview', 'vocabulary', 'names', 'games', 'packages'].includes(name)
    ? { ...original, run: args => withReadCache(ROOT, () => original.run(args)) } : original
  if (!tool.params.game || name === 'create_game') return [name, tool]
  return [name, {
    ...tool,
    params: { ...tool.params, game: 'string?', package: 'string?' },
    run(args) {
      if (args.game && args.package) throw new Error('choose one target: game or package')
      if (!args.game && !args.package) throw new Error('name a game or package')
      return tool.run({ ...args, game: args.package ? { package: args.package } : args.game })
    },
  }]
}))

function renderWork(content, text, title) {
  const renderer = meaningsOf(contentSchemas.get(content)).find(meaning => meaning.renderWork)
  if (!renderer) throw new Error('the loaded object kinds do not provide work rendering')
  return renderer.renderWork({ text, title })
}
