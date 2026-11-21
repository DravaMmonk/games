import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { L, Popover } from 'kernel/view'
import { tr } from 'kernel/words'
import { didText, goalLines, stepExplained } from '../../core/circuit-readouts.js'
import { Formula, MarkedFormula } from './Formula.jsx'
import { layoutProofTree } from './proof-tree-layout.js'

function Branch({ node, run, selected, open }) {
  const { id, parent, s, number, current, children, resultPath, error } = node
  const did = s && s.value?.didBy === s.entry.id ? s.value.did : null
  const nodeId = s?.entry.path?.length ? undefined : s?.entry.id
  const symbol = (did && didText(did, run, { marksOnly: true, nodeId })) || s?.entry.label || (s?.entry.round ? '↻' : '⊢')
  const label = number ? `${number} · ${L(s.label)} · ${symbol}` : symbol
  return (
    <li className={`mr-branch ${resultPath ? 'is-result' : ''} ${error && !resultPath ? 'is-error' : ''}`}>
      <button type="button" className={`mr-branch-node ${current ? 'is-on' : ''}`} aria-label={label} aria-expanded={selected === id}
        aria-current={current ? 'step' : undefined}
        data-branch={id} data-parent={parent}
        onClick={event => open(selected === id ? null : { id, anchor: event.currentTarget })}>
        {number != null && <span className="mr-branch-num">{number}</span>}
        <Formula text={symbol} />
      </button>
      {children.length > 0 && <ul>{children.map(child => <Branch key={child.id} node={child} run={run} selected={selected} open={open} />)}</ul>}
    </li>
  )
}

export function ProofTree({ root, steps, ended, run, task }) {
  const chart = useRef(null)
  const previous = useRef(null)
  const [edges, setEdges] = useState([])
  const [detail, setDetail] = useState(null)
  const showResultPath = ended || (steps.length > 0 && steps.length === run.trace.length)
  const nodes = useMemo(() => {
    const visible = (proof, step) => ({
      ...proof, ...step, children: [], resultPath: showResultPath && proof.resultPath,
      error: step?.s.failed || step?.s.value?.error || (ended && (proof.reason || proof.stopReason)),
    })
    const start = visible(root)
    const byId = new Map([[start.id, start]])
    for (const step of steps) {
      const proof = step.s.entry.proof
      if (!proof) continue
      const node = visible(proof, step)
      const parent = byId.get(node.parent) ?? start
      parent.children.push(node)
      byId.set(node.id, node)
    }
    return byId
  }, [root, steps, showResultPath, ended])
  useLayoutEffect(() => {
    const el = chart.current
    const viewport = el.parentElement
    const buttons = new Map([...el.querySelectorAll('[data-branch]')].map(button => [Number(button.dataset.branch), button]))
    const current = steps.find(step => step.current)?.s.entry.proof?.id
    const draw = () => {
      const size = getComputedStyle(el)
      const rowGap = parseFloat(size.rowGap)
      const columnGap = parseFloat(size.columnGap)
      const nodeHeight = buttons.get(root.id).offsetHeight
      const pitch = nodeHeight + rowGap
      const widths = new Map([...buttons].map(([id, button]) => [id, button.getBoundingClientRect().width]))
      const layout = layoutProofTree(nodes.get(root.id), widths, columnGap)
      const viewportWidth = viewport.clientWidth
      const center = Math.max(viewportWidth / 2, layout.left)
      const prior = previous.current
      const pan = prior?.root === root ? viewport.scrollLeft + prior.width / 2 - prior.center : 0
      el.style.width = `${center + Math.max(viewportWidth / 2, layout.right)}px`
      el.style.height = `${layout.rows * pitch - rowGap}px`
      for (const [id, { x, depth }] of layout.positions) {
        const button = buttons.get(id)
        button.style.left = `${center + x}px`
        button.style.top = `${depth * pitch}px`
      }
      const links = []
      for (const node of nodes.values()) {
        const parent = layout.positions.get(node.parent)
        if (!parent) continue
        const child = layout.positions.get(node.id)
        const from = center + parent.x
        const to = center + child.x
        const top = parent.depth * pitch + nodeHeight
        const bottom = child.depth * pitch
        const middle = (top + bottom) / 2
        links.push({ id: node.id, path: `M${from} ${top} V${middle} H${to} V${bottom}`, result: node.resultPath })
      }
      // Draw successful paths above the other branches at shared endpoints.
      setEdges(links.sort((a, b) => Number(a.result) - Number(b.result)))
      viewport.scrollLeft = center - viewportWidth / 2 + pan
      previous.current = { center, width: viewportWidth, root }
    }
    draw()
    const focus = buttons.get(current)
    if (focus) {
      const { left, right } = focus.getBoundingClientRect()
      const bounds = viewport.getBoundingClientRect()
      if (left < bounds.left || right > bounds.right) viewport.scrollLeft += (left + right - bounds.left - bounds.right) / 2
    }
    const resize = new ResizeObserver(draw)
    resize.observe(viewport)
    buttons.forEach(button => resize.observe(button))
    return () => resize.disconnect()
  }, [nodes, root, steps])
  const node = nodes.get(detail?.id)
  const explanation = node?.error || (node?.s && stepExplained(node.s.entry, run))
  const value = node?.closed ? { ...node.value, goals: node.closed } : node?.value
  return (
    <>
      <div className="mr-tree-scroll">
        <div className="mr-tree-chart" ref={chart}>
          <svg className="mr-tree-edges" aria-hidden="true">
            {edges.map(edge => <path key={edge.id} d={edge.path} className={edge.result ? 'is-result' : undefined} />)}
          </svg>
          <ul className="mr-tree" aria-label={tr('分支树')}>
            <Branch node={nodes.get(root.id)} run={run} selected={detail?.id} open={setDetail} />
          </ul>
        </div>
      </div>
      {node && (
        <Popover anchor={detail.anchor} title={node.s ? L(node.s.label) : tr('这一步做了什么')} onClose={() => setDetail(null)}>
          <div className="mr-branch-detail">
            {explanation && <p className="mr-told">{L(explanation)}</p>}
            {node.closed && <Formula text={tr('证明完毕')} className="mr-line" upright />}
            {value && goalLines(value, task).map((line, i) => <MarkedFormula key={i} line={line} className="mr-line" />)}
          </div>
        </Popover>
      )}
    </>
  )
}
