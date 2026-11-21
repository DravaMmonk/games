import '../logic.css'
import { NotationLabel } from 'notation/view'
import { proofScreen } from './proof.jsx'
import { gatesScreen } from './gates.js'
import { machineScreen } from './machine.js'
import { declaredLines } from '../../core/iso.js'

export const displays = {
  'logic/proof-screen': { ...proofScreen, labelRenderer: NotationLabel },
  'logic/gates-screen': { ...gatesScreen, labelRenderer: NotationLabel },
  'logic/machine-screen': { ...machineScreen, labelRenderer: NotationLabel },
  'logic/passed': declaredLines,
}
