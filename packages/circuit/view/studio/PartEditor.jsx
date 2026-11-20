import { GameFrame, namespaceOf, editorSlot } from 'kernel/view'
import { policyFor } from 'progress'
import Flow, { levelLabel } from './Flow.jsx'

// A part's page in the studio: its stages over it (when the course stages parts), the part or the stage picked drawn
// and edited in the frame, and under it where it comes into the course, what gathers it (`footer`, the workspace's)
// and, in a game, its way through the course. `content` is what the frame plays (in a package, one level); `workspace`
// the whole package or game, where the part's uses are read.
export default function PartEditor({ part, content, workspace = content, operations, namespace, stage, pending, onStage, onStages, target, changeset, names, onFlow, footer = null, ...frame }) {
  const StageChain = editorSlot(content, 'circuit/part', 'stageChain')
  const Uses = editorSlot(content, 'circuit/part', 'uses')
  const staged = StageChain && policyFor(content, 'circuit/part', part).stages
  return <GameFrame {...frame} content={content} object={{ kind: 'circuit/part', full: part }} stage={stage}
    header={staged && <StageChain part={part} raw={content?.partDefs?.parts?.[part]} operations={operations} namespace={namespace} stage={stage} pending={pending}
      editable={namespaceOf(part) === namespace} onStage={onStage} onAdd={onStages} />}
    footer={<>
      {Uses && <Uses content={workspace} part={part} namespace={namespace} onOpen={onFlow} />}
      {footer}
      {target && changeset && <Flow target={target} part={part} changeset={changeset} label={levelLabel(names)} onOpen={onFlow} />}
    </>} />
}
