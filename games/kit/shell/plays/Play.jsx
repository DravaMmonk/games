import { lazy, Suspense, useMemo } from 'react'
import { defineGame } from '../index.js'
import { tr } from '../i18n.js'

const FieldRows = lazy(() => import('./FieldRows.jsx'))
const ValueTables = lazy(() => import('./ValueTables.jsx'))

const bind = {
  values: (play, prepare) => resourceScreen(ValueTables, play, prepare),
  fields: (play, prepare) => resourceScreen(FieldRows, play, prepare),
}

export function resourceScreen(Screen, play, prepare) {
  return function ResourcePlay(screen) {
    const source = screen.level.source
    const resource = useMemo(() => prepare(source, screen), [source, screen.progress, screen.saved])
    return <Screen screen={screen} resource={resource} play={play} />
  }
}

/** Bind each declared play's resource to the screen selected by its editor. */
export function playKinds(plays, resources, presentation = {}, bindings = {}) {
  return Object.fromEntries(Object.entries(plays).map(([name, play]) => {
    if (!Object.hasOwn(resources, play.resources)) throw new Error(`play ${name}: missing resource ${play.resources}`)
    const Bound = (bindings[play.editor] ?? bind[play.editor])(play, resources[play.resources])
    const Screen = (screen) => (
      <Suspense fallback={<div className="board-loading">{tr('载入中…')}</div>}>
        <Bound {...screen} />
      </Suspense>
    )
    return [name, { label: play.label, ...presentation[name], Screen, editor: play.editor }]
  }))
}

export function playGame(content, { chapters, levels }, plays, resources) {
  return defineGame({ id: content.id, title: content.title, kicker: content.kicker, lede: content.lede, glossary: content.glossary, chapters, levels, kinds: playKinds(plays, resources) })
}
