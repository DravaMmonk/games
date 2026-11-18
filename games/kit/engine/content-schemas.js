// Core object schemas and environment-neutral vocabulary descriptions.
import { S } from './schema.js'
/**
 * The audit findings a game.json leaves open (`open`): { rule: [{ part, level }] }, the findings of the course audit
 * (../course.js) its curriculum has not met yet, each on the work list in the game's design doc. npm run check lists them
 * without failing, and fails on any other finding and on one listed that is gone.
 */
export const OPEN = S.map(S.list(S.obj({ part: S.str(), level: S.level() })))


export function defineVocabulary({ module, kinds, game, level, languages = {}, shapes }) {
  return { module, kinds, game, level, languages, ...(shapes && { shapes }) }
}

/** The vocabulary as plain data: its kinds and items with what they are and their parameters, and the content schemas. */
export const describe = (vocabulary) => JSON.parse(JSON.stringify(vocabulary.description ?? vocabulary, (key, value) => key === 'meanings' ? undefined : value))
