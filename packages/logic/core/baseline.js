import { exampleReports, withHidden } from 'kernel'
import { runProof } from './proof.js'
import { runMachine } from './machine.js'
import { runGates, gateTests } from './gates.js'
import { truth } from './truthValues.js'
import { checkDefine } from './define.js'
import { checkDeclaration, readRuleRows } from './ruleLines.js'
import { checkIso, sentenceOf } from './iso.js'
import { runAudit } from './audit-cases.js'
import { translation, query } from './formulaWork.js'
import { worldCheck } from './worldValues.js'
import { inspectScript } from './script.js'
import { parse } from './formula.js'
import { say } from './notation.js'

const judged = fail => ({ pass: !fail, fail, steps: [{ pass: !fail, fail }] })
const observed = ({ fail, run }) => ({ ...judged(fail), run })
const examples = (task, run, reference = task.solution ?? task.answer, naive = task.naive) => exampleReports(reference, naive, run)

function logicReport(task) {
  const words = sentence => say(sentenceOf(task, sentence), task.notation)
  switch (task.kind) {
    case 'logic/proof': case 'logic/machine': {
      const all = withHidden(task)
      const run = task.kind === 'logic/proof' ? runProof : runMachine
      return examples(task, work => run(all, work, { traced: true }))
    }
    case 'logic/gates': {
      const all = { ...task, tests: gateTests(task) }
      return examples(task, work => runGates(all, work, null, { traced: true }))
    }
    case 'logic/define': return examples(task, work => judged(checkDefine(task)(work)))
    case 'logic/script': return examples(task, work => observed(inspectScript(task, work)), task.answer)
    case 'logic/model': {
      const { report } = worldCheck(task)
      return examples(task, work => observed(report(work)), task.answer)
    }
    case 'logic/translate': case 'logic/query': {
      const judge = (task.kind === 'logic/query' ? query : translation)(task).judge
      return examples(task, work => judged(judge(typeof work === 'string' ? parse(work, { consts: task.vocab.names }) : work)), task.target)
    }
    case 'logic/iso': {
      const audit = task.play === 'logic/audit'
      const naiveRules = !audit && task.naive?.every(rule => rule.needs) ? task.naive : null
      const judge = audit ? checkIso(task, words) : rules => checkDeclaration(task)(readRuleRows(task, rules))
      const declaration = examples(task, work => judged(judge(work)), task.solution, naiveRules)
      return task.play === 'logic/audit' ? { declaration, cases: examples(task, work => runAudit(task, work, words), task.answer) } : declaration
    }
    case 'logic/truth': {
      const view = truth(task)
      const reference = { fill: view.tables[0].rows.map(r => r.value), marks: view.tables.map(t => t.rows.every(r => r.value)), tried: Object.fromEntries(view.tables.flatMap((t, f) => t.rows.flatMap((r, k) => r.value === (task.ask === 'sat') ? [[`${f}:${k}`, true]] : []))) }
      const naive = { fill: reference.fill.map(v => !v), marks: reference.marks.map(v => !v), tried: {} }
      return { tables: view.tables, ...examples(task, work => view.judge(work), reference, naive) }
    }
    default: throw new Error(`unobserved logic play ${task.kind}`)
  }
}

export function logicReports({ spec }) {
  if (!spec.logic) return null
  return spec.levels.flatMap(level => (spec.logic.played?.get(level.id) ?? level.tasks).map(task => ({ level: level.id, task: task.taskId ?? task.key ?? task.id, kind: task.mode ?? task.kind, report: logicReport(task) })))
}
