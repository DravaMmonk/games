import { L } from "kernel"
import { T } from 'kernel/words'
import { passedWork } from 'circuit'
import { AUDIT_CASE_LIMIT, auditResult, blankCase, restoreAuditCases, runAudit } from './audit-cases.js'
import { readPremise } from './iso.js'
import { ruleOf, statedRule } from './schematic.js'
import { say } from './notation.js'
import { checkDeclaration, linesOf, readRuleRows } from './ruleLines.js'
import { caseCells, DERIVABLE } from './auditCells.js'
import { declarationValues, inView, ruleLines } from './rowValues.js'

export function audit(source, { game, progress, saved }) {
  const parent = game.byId[source.carry]?.source.tasks.findLast((task) => task.kind === 'logic/iso' && task.play !== 'logic/audit')
  const kept = passedWork(progress, parent)?.rules
  const carried = kept && !checkDeclaration(parent)(kept) ? linesOf(kept) : null
  // One task tests one declaration; a level with several to test has a task for each.
  const level = { ...source, boards: [carried ? { rules: carried } : source.boards[0]] }
  const [board] = level.boards
  // The tabs are the level's cases and its letters (work.js caseViews): the same declaration and cases read in other
  // words; each runs the cases and says what it finds in its own.
  const tabs = level.views?.map(({ label }) => ({ label })) ?? [{ label: level.ruleAudit ? T("待检验规则") : T("这份声明") }]
  const reports = new Map()
  const report = (work, k = 0) => {
    if (reports.get(k)?.work !== work) {
      const seen = inView(level, k)
      reports.set(k, { work, report: runAudit(seen, work, (sentence) => say(readPremise(seen, sentence), seen.notation)) })
    }
    return reports.get(k).report
  }
  return {
    initial: restoreAuditCases(level, saved?.work),
    tabs,
    judge: (k, work) => report(work, k).runs[0].fail?.why,
    stepsOf: (k, work) => report(work, k).runs[0].steps.map((step) => step.failed ? { failed: L(step.failed) } : step),
    rows: (k) => declarationValues(inView(level, k), readRuleRows(level, board.rules)),
    lines: (k, read) => level.ruleAudit
      ? board.rules.map(({ needs }) => ({ name: read(T('待检验规则')), text: statedRule(ruleOf(null, null, needs, level.target)) }))
      : ruleLines(inView(level, k), board.rules, read),
    completion: auditResult,
    result: (work, _tab, reached) => {
      const { rows } = report(work)
      return (k) => {
        const whole = ['given', 'goal', 'make'].every((cell) => work[k]?.fixed?.includes(cell))
        const r = rows[k]
        if (!(k < reached || whole) || !r || r.derived[0] === null) return null
        const derived = r.derived[0]
        return { text: L(DERIVABLE.find((option) => option.value === derived).label), tone: r.right && derived !== r.wants ? 'wrong' : 'right' }
      }
    },
    passed: (work) => {
      if (level.ruleAudit) return T('这条条例找出了规则漏掉的情形。')
      if (level.want === 'logic/agree') return T('每一条条例的预期都符合需求，这份声明的结果也都和预期相符。')
      if (level.want === 'logic/expose') return T('每一条条例的预期都符合需求，这份声明的结果都和预期不符。')
      const { caught } = report(work)
      return T("已找出错误：这份声明在第 {value} 条条例上得出错误结论。", {value: caught[0] + 1})
    },
    go: T('运行检验条例'),
    done: level.want === 'logic/agree' ? T('结果全部相符') : T('已找出错误'),
    checks: (k) => ({
      cells: caseCells(inView(level, k)), resultLabel: T("实际结果"), blank: () => blankCase(level), max: AUDIT_CASE_LIMIT, addLabel: T('添加条例'),
      formTitle: (n) => T("第 {n} 条检验条例", {n: n + 1}),
      empty: T('还没有条例。'), fixed: Boolean(level.slots), tip: T('点按一条条例即可修改。'),
    }),
  }
}
