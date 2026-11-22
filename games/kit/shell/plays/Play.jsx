import { useMemo } from 'react'
import { defineGame } from '../index.js'

import FieldRows from './FieldRows.jsx'
import ValueTables from './ValueTables.jsx'

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
    return [name, { label: play.label, ...presentation[name], Screen: Bound, editor: play.editor }]
  }))
}

export function playGame(content, { chapters, levels }, plays, resources) {
  return defineGame({ id: content.id, title: content.title, topic: content.topic, lede: content.lede, glossary: content.glossary, chapters, levels, kinds: playKinds(plays, resources) })
}
