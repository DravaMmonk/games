import { T } from 'kernel/words'
import { LINE } from './line.js'

export const fixedCards = {
  line: { name: LINE, family: 'given', desc: T('这一拍线上的位。') },
  say: { name: T('说'), family: 'end', desc: T('接到这里的位，这一拍说到线上。') },
}
