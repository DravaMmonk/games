import { hidden } from './judge.js'
import { S, validate } from './schema.js'

export const TASK_BOARD_SECTIONS = ['title', 'brief', 'tip', 'hints', 'statement', 'readouts', 'extras']
const taskBoard = S.opt(S.list(S.oneOf(TASK_BOARD_SECTIONS)))
const fields = {
  checks: S.oneOf(['shown', 'hidden']),
  resources: S.str(),
  stage: S.str(),
  layout: S.str(),
  gives: S.opt(S.oneOf(['reference'])),
  taskBoard,
}
export const resourcePlaySchema = (editor, judges) => S.obj({ ...fields, editor: S.oneOf([editor]), judge: S.oneOf(judges) })

const label = S.obj({ zh: S.str(), en: S.str() })
export const PLAY = S.by('editor', {
  board: S.obj({
    editor: S.oneOf(['board']),
    judge: S.oneOf(['hand']),
    resources: S.str(),
    label,
    taskBoard,
    layout: S.obj({
      boardLabel: label,
      cardClass: S.str(),
      noteClass: S.str(),
      afterClass: S.str(),
      phoneClass: S.str(),
      desktopClass: S.str(),
      panelClass: S.str(),
    }),
  }),
  values: resourcePlaySchema('values', ['table']),
  fields: resourcePlaySchema('fields', ['rows']),
})

/** A play selects screen components and names the domain resources they use. */
export function definePlays(plays, extensions = {}) {
  for (const [name, play] of Object.entries(plays)) {
    const wrong = validate({ ...PLAY, cases: { ...PLAY.cases, ...extensions } }, play)
    if (wrong.length) throw new Error(`play ${name}: ${wrong.map((issue) => issue.says).join('; ')}`)
  }
  return plays
}

export const playId = ({ kind, play }) => play ?? kind
export const playFor = (plays, task) => plays[playId(task)]

export const judgeFor = (play, judge) => play.checks === 'hidden' ? hidden(judge) : judge
