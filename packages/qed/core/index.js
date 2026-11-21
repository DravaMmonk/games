import { registerWordSets } from 'logic'

export function register(kernel) {
  registerWordSets(kernel, 'qed/readings', 'qed/wordset')
}
