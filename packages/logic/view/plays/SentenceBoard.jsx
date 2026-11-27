import { useRef } from 'react'
import { TreeEditor } from 'sentence/view'
import { T } from 'kernel/words'
import { L, RunDock, Verdict, checkAction, PlayLayout, inspectWork, useCheckedWork } from 'kernel/view'
import BoardStage from './BoardStage.jsx'
import WorldGraph from '../ui/WorldGraph.jsx'

function TextLines({ lines }) {
  return (
    <div className="tree-description">
      {lines.map(({ text, strong }, k) => (
        <p key={k}>{L(text)}{strong && <b>{L(strong)}</b>}</p>
      ))}
    </div>
  )
}

/** One sentence built in place: its strip stands in the conclusion's row, the tray of cards under the rows. */
export default function SentenceBoard({ screen, resource, play }) {
  const { level: entry } = screen
  const { work: tree, verdict, check, change } = useCheckedWork(screen, {
    read: (saved) => saved?.tree ?? resource.initial ?? null,
    write: (tree) => ({ tree }),
  }, inspectWork(play, resource.judge))
  const editor = useRef(null)
  const stage = (
    <TreeEditor
      ref={editor} tree={tree} onChange={change} chips={resource.chips(tree)} language={resource.language} scope={`${entry.id}:${entry.source.task}`}
      layout={({ tools, strip, note, chips }) => (
        <BoardStage
          className={play.stage} say={resource.prompt}
          rows={{ className: 'lg-rule-table', rows: [{ name: T('逻辑语言'), head: true, slots: [{ live: strip }] }] }}
          workspace={<div className="lg-tray">{tools}{note}{chips}</div>}
        />
      )}
    />
  )
  const { failure } = verdict ?? {}
  let results = null
  if (verdict?.pass) results = <Verdict pass compact>{L(resource.passed)}</Verdict>
  else if (failure?.world) results = <div className="tree-evidence"><p>{L(failure.why)}</p><WorldGraph world={failure.world} parts={failure.parts} /></div>
  else if (failure?.lines) results = <div className="tree-evidence"><p>{L(failure.why)}</p>{failure.lines.length > 0 && <TextLines lines={failure.lines} />}</div>
  else if (failure) results = <p className="lg-error">{L(failure.why)}</p>
  const dock = <RunDock go={checkAction(() => {
    editor.current?.clearSelection()
    check()
  }, Boolean(verdict?.pass))} />
  return <PlayLayout screen={screen} play={play} stage={stage} results={results} dock={dock} />
}
