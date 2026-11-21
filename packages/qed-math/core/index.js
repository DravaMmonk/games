import { registerWordSets } from 'logic'

export function register(kernel) {
  registerWordSets(kernel, 'qed-math/readings', 'qed-math/wordset')
}
