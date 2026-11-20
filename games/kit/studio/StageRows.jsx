// An object's stages under its row in a build list, as a level's tasks are under it in the tree: one row a stage, in
// order, its number and its title (else its id); the one open marked. Which objects have stages, and which, a meaning
// says (editors.js objectStages: the progress package, for what it records); nothing is drawn for an object without.
import { L, tr } from '../shell/i18n.js'
import { objectStages } from './editors.js'
import { shownName } from './objects-edit.js'

/** `kind`/`of` the object; `name` what its row is called; `stage` the stage open ({ of, id }); `onStage(of, stage)`. */
export default function StageRows({ content, kind, of, name, namespace, stage, onStage }) {
  const stages = onStage ? objectStages(content, kind, of) : []
  if (!stages.length) return null
  return (
    <div className="tree-tasks" role="group" aria-label={tr("{name} 的阶段", { name: name || shownName(namespace, of) })}>
      {stages.map((step) => {
        const on = stage?.of === of && stage.id === step.id
        return (
          <button key={step.id} type="button" className={`tree-task tree-stage ${on ? 'is-on' : ''}`} title={step.id} aria-current={on ? 'true' : undefined} onClick={() => onStage(of, step)}>
            <small>{step.index}</small><span>{L(step.title) || shownName(namespace, step.id)}</span>
          </button>
        )
      })}
    </div>
  )
}
