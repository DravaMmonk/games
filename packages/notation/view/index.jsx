import { getLang } from 'kernel/view'
import { notationPlain, notationRuns } from '../core/index.js'
import './notation.css'

export function register() {}

const paths = {
  'not': 'M2 6h12v5',
  'and': 'm3 12 5-8 5 8',
  'or': 'm3 4 5 8 5-8',
  'implies': 'M2 8h12m-4-4 4 4-4 4',
  'left': 'M14 8H2m4-4L2 8l4 4',
  'backward': 'M15 8H1m4-4L1 8l4 4',
  'iff': 'M2 8h12M5 5 2 8l3 3m6-6 3 3-3 3',
  'entails': 'M1 6h11M1 10h11M10 3l5 5-5 5',
  'maps-to': 'M2 5v6m0-3h12m-4-4 4 4-4 4',
  'rewrite': 'M3 4h10M3 8h10M3 12h10',
  'equals': 'M3 6h10M3 10h10',
  'bottom': 'M8 3v10m-5 0h10',
  'top': 'M8 13V3M3 3h10',
  'forall': 'M3 3l5 10 5-10M5 7h6',
  'exists': 'M3 3h10v10H3m1-5h9',
  'proves': 'M4 3v10m0-5h9',
  'turn': 'M3 11a5 5 0 0 1 10 0m-3-2 3 2 2-3',
  'repeat': 'M13 7a5 5 0 1 0-1 5m-2-6 3 1 1-3',
  'exit': 'M2 11V9a2 2 0 0 1 2-2h10m-3-3 3 3-3 3',
  'dot-equals': 'M3 7h10M3 11h10M8 3v.1',
  'not-equal': 'M3 6h10M3 10h10m-2-7-6 10',
  'at-most': 'm12 3-8 4 8 4M4 14h8',
  'at-least': 'm4 3 8 4-8 4m0 3h8',
  'in': 'M12 3H8a5 5 0 0 0 0 10h4M3 8h9',
  'times': 'm4 4 8 8m0-8-8 8',
  'divide': 'M3 8h10m-5-4v.1M8 12v.1',
  'dot': 'M8 8h.1',
  'check': 'm3 8 3 3 7-7',
  'cross': 'm4 4 8 8m0-8-8 8',
  'meta-all': 'm2 13 6-10 6 10',
  'open-bracket': 'M7 2H4v12h3M11 2H8v12h3',
  'close-bracket': 'M5 2h3v12H5m4-12h3v12H9',
  'xor': 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm-3 6h6m-3-3v6',
}

const digitPaths = [
  'M2.5 0C1 0 .5 1.2.5 4s.5 4 2 4 2-1.2 2-4-.5-4-2-4Z',
  'M1 2l2-2v8M1 8h4',
  'M.5 2a2 2 0 0 1 4 0c0 1.7-4 3.5-4 6h4',
  'M.5 1a2 2 0 1 1 2 3 2 2 0 1 1-2 3',
  'M3.5 8V0l-3 5.5h4',
  'M4.5 0h-4v4C3 2 4.5 4 4.5 5.5S3.5 9 .5 7',
  'M4 0C1 0 .5 2.5.5 5c0 4 4 4 4 .5s-4-2.5-4 0',
  'M.5 0h4l-3 8',
  'M2.5 4c-3 0-2.5-4 0-4s3 4 0 4-3 4 0 4 3-4 0-4Z',
  'M1 8c3 0 3.5-2.5 3.5-5 0-4-4-4-4-.5s4 2.5 4 0',
]

function CircledNumber({ number }) {
  const digits = [...String(number)]
  return <>
    <circle cx="8" cy="8" r="6.75" />
    <g transform={digits.length === 2 ? 'translate(3.4 4.8) scale(.8)' : 'translate(5.5 4)'}>
      {digits.map((digit, i) => <path key={i} d={digitPaths[digit]} transform={i ? 'translate(6.5)' : undefined} />)}
    </g>
  </>
}

function Mark({ mark }) {
  return <svg className="notation-mark" data-mark={mark.id} viewBox="0 0 16 16" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {mark.number ? <CircledNumber number={mark.number} /> : <path d={paths[mark.id]} />}
  </svg>
}

/** Replace just the explicit commands, preserving the paragraph's native wrapping. */
export function NotationText({ text }) {
  const lang = getLang()
  return notationRuns(text).map((run, i) => typeof run === 'string' ? run
    : <span className="notation-inline" key={i}>
      <span className="notation-label-text">{run[lang]}</span><Mark mark={run} />
    </span>)
}

/** Center signs with adjacent text in compact card names and labels. */
export function NotationLabel({ label }) {
  if (typeof label !== 'string') return label
  const runs = notationRuns(label)
  if (runs.length === 1 && runs[0] === label) return label
  const lang = getLang()
  return <span className="notation-label">
    <span className="notation-label-text">{notationPlain(label, lang)}</span>
    <span className="notation-label-art" aria-hidden="true">
      {runs.map((run, i) => typeof run === 'string' ? run && <span key={i}>{run}</span> : <Mark key={i} mark={run} />)}
    </span>
  </span>
}
