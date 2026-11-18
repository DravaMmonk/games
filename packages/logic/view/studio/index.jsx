import { T } from 'kernel/words'
import SymbolEditor from './SymbolEditor.jsx'

/** Register symbol authoring and navigation with the generic Studio shell. */
export function registerEditors(kernel) {
  kernel.editor('logic/symbol', { type: 'logic/symbol', component: SymbolEditor,
    listKey: 'symbols', name: T('符号', {}, 'studio-editor'), groupings: ['tag', 'circuit/tray', 'relation'] })
}
