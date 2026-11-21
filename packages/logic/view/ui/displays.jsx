import '../logic.css'
import { FormulaText, L } from 'kernel/view'
import { T, tr } from 'kernel/words'
import { NotationLabel } from 'notation/view'
import { proofScreen } from './proof.jsx'
import { gatesScreen } from './gates.js'
import { machineScreen } from './machine.js'
import { declaredRules, typeOf } from '../../core/iso.js'
import { datatypeRules, typeText } from '../../core/datatype.js'
import { statedRule } from '../../core/schematic.js'
import { machineTermOf, machineTextOf } from '../../core/circuit-readouts.js'

function passedDeclaration(level) {
  const text = machineTextOf(level)
  const rule = (r, label) => <>{label}<FormulaText text={statedRule(r, text)} /></>
  const label = T('声明给出的规则')
  if (level.datatype) {
    const name = level.datatype.type
    const type = typeOf(level)
    return {
      label,
      lines: [
        <FormulaText text={typeText(name, type, machineTermOf(level))} />,
        ...datatypeRules(name, type).map(r => rule(r, `${L(r.name)}：`)),
      ],
    }
  }
  const { make, take } = declaredRules(level, level.solution)
  return {
    label,
    lines: [...make.map((r, k) => rule(r, tr('引入规则 {k}：', { k: k + 1 }))), rule(take, tr('消去规则：'))],
  }
}

export const displays = {
  'logic/proof-screen': { ...proofScreen, labelRenderer: NotationLabel },
  'logic/gates-screen': { ...gatesScreen, labelRenderer: NotationLabel },
  'logic/machine-screen': { ...machineScreen, labelRenderer: NotationLabel },
  'logic/passed': passedDeclaration,
}
