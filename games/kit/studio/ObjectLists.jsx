import { editorForType } from './editors.js'
import { tr } from '../shell/i18n.js'

export const tagKindWord = kind => tr(...(editorForType(kind)?.name ?? (kind === 'level' ? ['关卡', 'Levels'] : [kind, kind])))
