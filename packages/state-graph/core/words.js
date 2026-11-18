import { T as words } from 'kernel/words'
import { asText } from 'table'

export const T = (...args) => asText(words(...args))
