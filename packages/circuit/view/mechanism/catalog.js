// What the cards a circuit level puts on its board are called and what they do. A game's own parts are described in
// its parts.json (games/design/README.md 6.8).
import { ArrowRightFromLine } from 'lucide-react'
import { T } from 'kernel/words'



export const CARDS = {
  in: { name: T("输入", {}, "catalog"), icon: ArrowRightFromLine, family: 'given', desc: T('这个测试给的值。') },
  out: { name: T("输出", {}, "catalog"), icon: ArrowRightFromLine, family: 'end', desc: T('接到这里的值，就是电路的输出。') },
}
