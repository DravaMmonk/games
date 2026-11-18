import { GameFrame, namespaceOf, editorSlot } from 'kernel/view'
import { policyFor } from 'progress'
import Flow, { levelLabel } from './Flow.jsx'

export default function PartEditor({ part, content, operations, namespace, stage, pending, onStage, onStages, target, changeset, names, onFlow, ...frame }) {
  const StageChain = editorSlot(content, 'circuit/part', 'stageChain')
  return <GameFrame {...frame} content={content} object={{ kind: 'circuit/part', full: part }} stage={stage} footer={<>
    {StageChain && policyFor(content, 'circuit/part', part).stages && <StageChain part={part} raw={content?.partDefs?.parts?.[part]} operations={operations} namespace={namespace} stage={stage} pending={pending}
      editable={namespaceOf(part) === namespace} onStage={onStage} onAdd={onStages} />}
    {target && changeset && <Flow target={target} part={part} changeset={changeset} label={levelLabel(names)} onOpen={onFlow} />}
  </>} />
}
