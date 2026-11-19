// A blind session under node (./cli.mjs, ./tool.mjs): the game as the shell gets it, its runtime using the same plugin
// instances, and the session's record on disk
// (games/<game>/playtests/<session>.json, ./session.js). Run from site, as npm run play does.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gameDirectory, readContent } from '../resolver.js'
import { gameOf } from '../games.mjs'
import { runtimeFromPlugins } from '../runtime.js'
import { createPlay } from './play.js'
import { fresh } from '../../shell/progress.js'
import { checkPlaytest, newSession } from './session.js'

/** Where a session's record lives. */
export const recordFile = (game, session, dir = gameDirectory()) => resolve(dir, game, 'playtests', `${session}.json`)

let loadedLang = null

/**
 * Game `game` (its id, or a content as content.js assembles one) ready to play in `lang`: { shell (defineGame's
 * result), hook (its domain's play hook), content }. The language is the shell's,
 * chosen before the first game loads: one language a process.
 */
export async function loadPlay(game, lang = 'en') {
  if (loadedLang && loadedLang !== lang) throw new Error(`this process plays in ${loadedLang}, not ${lang}`)
  if (!loadedLang) {
    globalThis.localStorage.setItem('games.lang', lang)
    loadedLang = lang
  }
  const content = typeof game === 'string' ? readContent(game) : game
  const shell = await gameOf(content)
  const domain = runtimeFromPlugins(content, shell.pluginKernel)
  if (!domain.play) throw new Error('the selected runtime has no play hook')
  return { shell, hook: domain.play, content }
}

/** Open (or start) session `session` of game `game`. A new session takes `options`: { lang, player, attempts, levels }. */
export async function openSession(game, session, options = {}) {
  const file = recordFile(game, session)
  const record = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  const lang = record?.lang ?? options.lang ?? 'en'
  const { shell, hook } = await loadPlay(game, lang)
  const rec = record ?? newSession({ game, session, lang, progress: fresh(), ...options })
  const play = createPlay({ game: shell, hook, record: rec })
  const save = () => {
    const wrong = checkPlaytest(rec)
    if (wrong.length) throw new Error(`the session record does not fit its schema: ${wrong.map((w) => `${w.at} ${w.says}`).join('; ')}`)
    mkdirSync(resolve(file, '..'), { recursive: true })
    writeFileSync(file, `${JSON.stringify(rec, null, 1)}\n`)
  }
  return { play, record: rec, save, file }
}
