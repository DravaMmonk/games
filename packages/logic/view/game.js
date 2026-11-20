import { T as catalogText } from 'kernel/words'
import { sentenceScreen } from 'sentence/view'
import { symbolFor } from '../core/symbols.js'
import { circuitScreen } from 'circuit/view'
import { displays as ui } from './ui/displays.js'
// A logic game on the shared shell (../../shell), from its content (games/design/README.md 6.3): the course (course.js)
// becomes the shell's game description, with the logic domain's screens (a proof on the circuit editor, a truth table,
// a machine board …), its parts box of proved lemmas and built parts, and its map art.
import { CircuitBoard, Cog, Cpu, FileSignature, Grid2x2Check, Languages, ScrollText, Search, SquareFunction, Workflow } from 'lucide-react'
import { defineGame } from 'circuit/view'
import { fresh, isCore } from 'circuit'
import { logicPartCatalog } from '../core/part-catalog.js'
import { tr } from 'kernel/words'
import { worldCheck } from '../core/worldValues.js'
import { query, translation } from '../core/formulaWork.js'
import { script } from '../core/scriptValues.js'
import { KERNEL_RULES, lemmaRules, ruleText } from '../core/schematic.js'
import { RULES } from '../core/proof.js'
import { logicWorks } from '../core/work.js'
import { playKinds, resourceScreen } from 'kernel/view'
import { iconOf as partIcon } from 'circuit/view'
import { OPS } from '../core/ops.js'
import { plays } from '../core/plays.js'
import { declaration, definition } from '../core/rowValues.js'
import { audit } from '../core/auditWork.js'
import { truth } from '../core/truthValues.js'

import Rows from './plays/Rows.jsx'
import BoardChecks from './plays/BoardChecks.jsx'
import ScenarioCheck from './plays/ScenarioCheck.jsx'

const bindings = {
  circuit: circuitScreen,
  sentence: sentenceScreen,
  tree: (play, prepare) => resourceScreen(Rows, play, prepare),
  scenario: (play, prepare) => resourceScreen(ScenarioCheck, play, prepare),
  checks: (play, prepare) => resourceScreen(BoardChecks, play, prepare),
}

// A level's declaration task, if it has one: a declaration on the rule board (iso.js).
const isoOf = (level) => level.tasks.find((t) => t.kind === 'logic/iso') ?? null
// A level that gives proof-board rules by passing it (a declaration, a generator), rather than by playing on the proof
// board.
const givesRules = (level) => !level.source.tasks.some((t) => t.kind === 'logic/proof')

// These proof-board operations are not entries in the machine board's rule book.
const proofRules = {
  'logic/rewrite': '⟦?s = ?t; ?P(?s)⟧ ⟹ ?P(?t)',
  'logic/natInd': '⟦?P(0); ⋀a. ⟦?P(a)⟧ ⟹ ?P(S(a))⟧ ⟹ ∀x. ?P(x)',
}

/**
 * content (../../engine/content.js; vocabulary.js GAME): { id, title, kicker, lede, …the course (course.js), levels,
 * glossary }.
 */
export default function logicGame(content, logic = logicWorks(content), { kernel } = {}) {
  const { LEVELS, CHAPTERS, LABELS } = logic
  const { gates, lemmas, parts } = logic
  // The parts the game defines (parts.json's and its lemmas'), as the circuit screen draws them.
  const cards = Object.fromEntries(Object.entries(logic.defs).map(([type, d]) => [type, { name: d.name, desc: d.desc, icon: partIcon(d.icon), family: d.family }]))
  // How parts' descriptions grow along the course (the components box reads them as far as the player has got).
  // A built part is a proved lemma, a gate built on a truth circuit or a machine part (simp, auto…): a part of
  // parts.json.
  const machines = Object.fromEntries(logic.machines.map((type) => [type, parts[type]]))
  // The course read a built part opens on, for the components box: a gate's truth circuit; a machine part's machine
  // board, as the last task it refers to holds it; a lemma's proof of its first shape; a proved equation's task.
  const tasks = new Map(LEVELS.flatMap((L) => L.tasks).map((task) => [task.taskId, task]))
  const boardOf = (type) => {
    if (gates[type]?.built) return logic.truthCircuits
    const producer = tasks.get(logic.publishers[type]?.at(-1))
    if (machines[type] && producer) return { ...logic.machineBoards, BUILT: logic.machineBoards.forTask(producer).BUILT }
    const proof = lemmas[type] && Object.values(logic.proofs[type] ?? {})[0]
    if (proof) return { ...logic.proofBoards, BUILT: { [type]: { opens: () => ({ circuit: proof.board(), level: proof.level }) } } }
    // A proved equation, in the studio: the reference answer of the task that proves it.
    const task = logic.facts[type] && tasks.get(logic.publishers[type]?.[0])
    const boards = logic.circuitFor(task)
    return boards ? { ...boards, BUILT: { [type]: { opens: () => ({ circuit: task.solution, level: task }) } } } : null
  }
  // The parts box lists circuit parts, each from the levels that bring it in.
  // The rules a proof-board part gives as a rule part on the machine board (the kernel's rules it is), and those a
  // lemma gives, one for each of its shapes: a shape after the first only once the player has earned it (`form`).
  const kernelRules = (type) => {
    const resource = logic.partResources[type]
    if (proofRules[resource]) return [{ text: proofRules[resource] }]
    return KERNEL_RULES.filter((r) => `logic/${r.part}` === resource).map((r) => ({ text: ruleText(r) }))
  }
  const lemmaRows = (type) => lemmaRules(type, lemmas[type]).map((r, k) => ({ text: ruleText(r), ...(k ? { form: r.key.split('.')[1] } : {}) }))
  const catalog = logicPartCatalog(logic)
  const primitives = catalog.primitives.map(part => {
    const type = part.part
    const rules = part.rules ?? kernelRules(type)
    return { ...part, icon: cards[type]?.icon ?? partIcon(part.icon) ?? Cpu, ...(rules.length ? { rules } : {}) }
  })
  // A part is new in the level that first brings its idea in (`adds`); everything else carries (../../course.js reach).
  const levels = LEVELS.map((L, index) => ({
    id: L.id,
    index,
    source: L,
    // Marked 新 where its idea is met first: not a part brought in again (a part that stays where it is brought).
    fresh: [...fresh(logic.course, { id: L.id })].map(logic.course.partOf),
    chapter: L.chapter,
    requires: L.requires,
    title: L.title,
    kind: L.kind,
    unlocks: L.unlocks,
    // A level whose boards a part runs: one that builds it, and one that proves a lemma's shape (course.js lemmaWorks).
    keeps: L.unlocks.length > 0 || logic.provers.has(L.id),
    brief: L.brief,
    after: L.after,
    // A level is its tasks (../../engine/tasks.js): the shell plays each as the level with the task's fields over it,
    // its screen reading the task as the course read it (`source`).
    tasks: L.tasks.map((t) => ({ key: t.taskId, kind: t.kind, play: t.play, step: t.step, source: t, fresh: [...fresh(logic.course, { id: L.id, task: t.task })].map(logic.course.partOf), brief: t.brief, after: t.after, carries: t.carries, intro: t.intro })),
  }))
  const game = defineGame({
    id: content.id,
    course: logic.course,
    glossary: content.glossary,
    title: content.title,
    kicker: content.kicker,
    lede: content.lede,
    Hero: kernel?.tables.display.get(content.hero),
    chapters: CHAPTERS.map((chapter, id) => ({ id, title: chapter.title, question: chapter.question, track: chapter.track, rows: chapter.rows })),
    levels,
    levelLabel: (level) => LABELS.get(level.id) ?? String(level.index + 1),
    intro: (level) => level.source.intro,
    kinds: playKinds(plays, {
      declaration, definition, audit, truth, translation, query, script, worldCheck,
      proof: { ...ui['logic/proof-screen'], cards }, machine: { ...ui['logic/machine-screen'], cards }, gates: { ...ui['logic/gates-screen'], cards },
    }, {
      'logic/proof': { icon: Workflow, label: catalogText("证明") },
      'logic/machine': { icon: Cog, label: catalogText("证明助手") },
      'logic/truth': { icon: Grid2x2Check, label: catalogText("真值表") },
      'logic/gates': { icon: Cpu, label: catalogText("真值电路") },
      'logic/iso': { icon: FileSignature, label: catalogText("规则板") },
      'logic/define': { icon: SquareFunction, label: catalogText("定义", {}, "game") },
      'logic/translate': { icon: Languages, label: catalogText("翻译") },
      'logic/query': { icon: Search, label: catalogText("查询") },
      'logic/model': { icon: FileSignature, label: catalogText("造世界") },
      'logic/script': { icon: ScrollText, label: catalogText("写脚本") },
    }, bindings),
    // What passing a level gives: the parts it builds, and the proof-board parts a declaration or a generator gives (its
    // rules, from here on).
    unlocked: (level) => [
      ...level.unlocks.map((flag) => flag.slice('lemma:'.length)).filter((type) => !logic.course.local(type)).map((type) => ({ part: type, label: parts[type].name })),
      ...(givesRules(level) ? level.source.adds : []).filter((type) => RULES[type]).map((type) => primitives.find((p) => p.part === type)).filter(Boolean).map((p) => ({ part: p.part, label: p.name, icon: p.icon, family: 'logic/rule' })),
    ],
    passed: (level) => {
      const declared = isoOf(level.source)
      return declared ? ui['logic/passed'](declared) : null
    },
    core: (level) => isCore(logic.course, level),
    parts: {
      all: [
        ...primitives,
        ...catalog.gates.map(part => ({ ...part, icon: CircuitBoard })),
        ...catalog.lemmas.map(part => ({ ...part, icon: cards[part.part].icon, rules: lemmaRows(part.part) })),
        ...catalog.machines.map(part => ({ ...part, icon: CircuitBoard })),
      ].map(part => ({ ...part, rulesAt: content.partRulesAt })),
      // A built part shows the board it runs: the one the player passed its task with, else the reference.
      preview: (part, { progress }) => {
        const shown = part.part && boardOf(part.part)
        if (!shown) return { structureOnly: true }
        logic.syncOwn(progress?.built)
        return { inside: { course: shown, cards }, structureOnly: true }
      },
    },
    // Fewer steps (proof steps, or gates) is better; fewer cases, where the player writes them (audit-cases.js).
    better: (score, best) => Boolean(score) && (!best || score.steps < best.steps),
    bestLabel: (best) => (best.unit === 'cases' ? tr("{steps} 条", {steps: best.steps}) : tr("{steps} 步", {steps: best.steps})),
  })
  game.symbolUnlocks = (level, before, after) => {
    if (before.solved.includes(level.id) || !after.solved.includes(level.id)) return []
    return Object.values(logic.symbols).filter(symbol => symbol.at === level.id)
      .map(symbol => ({ key: symbol.type, kind: 'symbol', label: symbol.name, chip: symbolFor[symbol.mark], caption: catalogText("符号") }))
  }
  game.logic = logic
  game.circuit = { forTask: (task) => logic.circuitFor(task)?.forTask(task) }
  game.defined = { of: (type) => logic.defs[type] ?? logic.symbols[type] ?? null, defaults: logic.defaultsOf, ops: OPS }
  game.workReferences = ({ task, work }) => logic.workReferences(task, work)
  return game
}
