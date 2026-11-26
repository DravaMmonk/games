import { Markup, NamedLines } from 'kernel/view'
import TreeRows from './TreeRows.jsx'

// One board for every task that writes or reads sentences (a translation, a declaration, a rule, a check), top to
// bottom: what is wanted, in natural language; the sentences, as rule rows (the conclusion, then the situations);
// where a sentence is built, when the board builds one in place; the check table.
//
//   say        the requirement (a sentence to translate, what a declaration must do)
//   rows       rule rows (TreeRows.jsx): their editor opens a sentence in a popup
//   lines      named lines under the rows (the rules a declaration gives)
//   workspace  the tray a sentence written in place is built with
//   table      the check table
export default function BoardStage({ className = '', say, rows, lines, workspace, table }) {
  return (
    <div className={`lg-board ${className}`}>
      {say && <p className="fo-say fo-prompt"><Markup text={say} /></p>}
      {rows && <TreeRows {...rows} />}
      {lines && <NamedLines lines={lines} formulas />}
      {workspace}
      {table}
    </div>
  )
}
