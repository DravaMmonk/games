import './sentence.css'
import { lazy } from 'react'
import { resourceScreen } from 'kernel/view'

export { default as TreeEditor } from './strip/TreeEditor.jsx'
export { Strip } from './strip/Strip.jsx'
export { SentenceRow, TreeButton, TreeList } from './strip/TreePick.jsx'

const SentenceWork = lazy(() => import('./SentenceWork.jsx'))
export const sentenceScreen = (play, prepare) => resourceScreen(SentenceWork, play, prepare)

export function register() {}
