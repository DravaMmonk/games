import { TreeEditor } from 'sentence/view'
import { L, RuleRows } from 'kernel/view'

/** Rule rows whose editable slots are tree works. */
export default function TreeRows({ editor, ...rows }) {
  const adapt = editor && {
    close: editor.close,
    title: (k, j) => {
      const { title, equation } = editor.slot(k, j)
      return equation ? `${L(title)} =` : L(title)
    },
    render: (k, j) => {
      const { title: _, equation: _equation, ...slot } = editor.slot(k, j)
      return <div className="ks-tree-box"><TreeEditor key={slot.scope} {...slot} /></div>
    },
  }
  return <RuleRows {...rows} editor={adapt} />
}
