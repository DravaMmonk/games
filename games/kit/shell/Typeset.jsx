import { Component, Suspense, lazy } from 'react'

// TeX typeset inline (KaTeX, loaded when first needed). Until it has loaded, and for good if it cannot load or a
// formula cannot be set, the plain text stands in its place: a page never goes blank for want of its typesetting.
// A load that fails throws to the boundary below, which keeps the plain text.
const TypesetMath = lazy(() => import('./TypesetMath.jsx'))

class Fallback extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.plain : this.props.children }
}

/** `tex` typeset, or `plain` (a node: the same thing in plain text) while it loads or if it fails. */
export function Typeset({ tex, plain, display = false }) {
  return (
    <Fallback plain={plain}>
      <Suspense fallback={plain}>
        <TypesetMath tex={tex} display={display} />
      </Suspense>
    </Fallback>
  )
}
