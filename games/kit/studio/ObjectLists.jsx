import { L, T } from '../shell/i18n.js'
import { editorForType } from './editors.js'

export const tagKindWord = kind => L(editorForType(kind)?.name ?? (kind === 'level' ? T('关卡', {}, 'grouped-list') : kind))
