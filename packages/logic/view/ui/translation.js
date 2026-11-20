import { T } from 'kernel/words'
import { say } from '../../core/notation.js'

/** Show the checked work even if the player has since changed the draft. */
export function translationStatements(level, progress) {
  if (!level.translationFrom) return []
  const solution = progress.solutions?.[level.translationFrom]
  const tree = solution?.works.find(({ id }) => id === solution.root)?.work?.tree
  return tree ? [{ label: T('你的译文'), formula: say(tree, { ...level.notation, brackets: true }) }] : []
}
