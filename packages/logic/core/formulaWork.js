import { punctuation } from 'kernel'
import { cases, inOrder, property } from 'kernel'
import { sideOf } from "kernel"
import { T } from 'kernel/words'
import { difference, extent, structureOf, vocabulary } from './fol.js'
import { freeVars, parse } from './formula.js'
import { chipsOf, complete, straysOf } from './formulaTree.js'
import { sentenceLanguage, STRAY } from './sentenceLanguage.js'
import { say } from './notation.js'
import { thingName, worldDescription, worldOf, worldParts } from './worldValues.js'

function formulaReady(free) {
  return inOrder(
    property((tree) => !straysOf(tree).length, () => ({ why: STRAY })),
    property(complete, () => ({ why: T('还有空位：句子的每个位置都须填写。') })),
    (tree) => {
      const loose = [...freeVars(tree)].filter((v) => !free.includes(v))
      return loose.length ? { why: T("{value} 不受 ∀ 或 ∃ 约束：它指的是什么？", {value: { zh: String(loose.join('、')), en: String(loose.join(', ')) }}) } : null
    },
  )
}

export function translation(level) {
  const { notation } = level
  const target = parse(level.target, { consts: level.vocab.names })
  const chips = chipsOf(level)
  const judge = inOrder(formulaReady([]), (tree) => {
    const counterexample = difference(tree, target)
    if (!counterexample) return null
    const { first, model } = counterexample
    // The world shows what the two sentences speak of, and nothing else the level's cards could say.
    const spoken = vocabulary([tree, target])
    return {
      want: !first,
      got: first,
      why: first ? T('在以下情形中，你写的句子为真，原句却为假：') : T('在以下情形中，原句为真，你写的句子却为假：'),
      world: worldOf(model, spoken),
      parts: worldParts(spoken, notation),
    }
  })
  return { judge, prompt: level.say, chips: () => chips, language: sentenceLanguage(notation, 'formula', []), passed: T('在检验过的所有情形中，真假都与原句一致。') }
}


export function query(level) {
  const { notation, worlds } = level
  const target = parse(level.target, { consts: level.vocab.names })
  const chips = chipsOf(level)
  const judge = cases(worlds, (tree, world) => {
    const model = structureOf(world, [tree, target])
    const [got, want] = [extent(tree, model), extent(target, model)]
    const extra = got.filter((d) => !want.includes(d))
    const missing = want.filter((d) => !got.includes(d))
    if (!extra.length && !missing.length) return null
    const message = (lang) => {
      const name = thingName(notation, world, lang)
      const head = sideOf(world.title, lang) + punctuation("：", lang)
      const picked = extra.map(name)
      const omitted = missing.map(name)
      if (lang === 'zh') return head + (picked.length ? `多选了 ${picked.join('、')}；` : '') + (omitted.length ? `漏掉了 ${omitted.join('、')}。` : '')
      return head + (picked.length ? `wrongly picks ${picked.join(', ')}; ` : '') + (omitted.length ? `misses ${omitted.join(', ')}.` : '')
    }
    // The family is not on the board while the sentence is built: the failure shows it.
    return { want, got, why: { zh: message('zh'), en: message('en') }, lines: worldDescription(model, notation, level.vocab.preds, world) }
  })
  return {
    judge: inOrder(formulaReady(['x']), judge),
    prompt: level.say,
    chips: () => chips,
    language: sentenceLanguage(notation, 'formula', ['x']),
    passed: T('每一家都选对了。'),
  }
}

/**
 * A query checked family by family (play logic/lookup): for each world the player says which things the query should
 * pick (the expected result); a run evaluates the query there and compares, stopping at the first that differs.
 * Work: for each world, the things picked (their indices).
 */
export function queryCheck(level) {
  const { notation, worlds } = level
  const target = parse(level.target, { consts: level.vocab.names })
  const shown = worlds.map((world) => {
    const model = structureOf(world, [target])
    return { world, model, want: extent(target, model) }
  })
  const named = (world, things) => {
    const list = (lang) => things.map(thingName(notation, world, lang)).join(punctuation('、', lang))
    return things.length ? { zh: list('zh'), en: list('en') } : T('无')
  }
  const same = (a, b) => a.length === b.length && a.every((d) => b.includes(d))
  const report = (picked) => {
    const rows = shown.map((row, k) => ({ ...row, right: same(picked[k] ?? [], row.want) }))
    const at = rows.findIndex((row) => !row.right)
    const fail = at < 0 ? null : { check: at, why: T('{title}：查询选中的是{got}，和预期不符。', { title: rows[at].world.title, got: named(rows[at].world, rows[at].want) }) }
    return { rows, fail }
  }
  return {
    initial: worlds.map(() => []),
    answer: shown.map((row) => row.want),
    prompt: level.say,
    board: { className: 'lg-rule-table', rows: [{ name: T('逻辑语言'), head: true, slots: [{ text: say(target, notation) }] }] },
    worlds: shown.map(({ world, model }) => ({
      title: world.title,
      lines: worldDescription(model, notation, level.vocab.preds, world),
      things: model.domain.map((d) => ({ value: d, text: named(world, [d]) })),
    })),
    judge: (picked) => report(picked).fail,
    run: (picked) => {
      const { rows, fail } = report(picked)
      return {
        steps: rows.slice(0, fail ? fail.check + 1 : undefined).map((_, k) => (k === fail?.check ? { failed: fail.why } : {})),
        lines: rows.map((row, k) => ({ text: named(row.world, row.want), right: row.right, step: k })),
      }
    },
    go: T('运行'), done: T('全部相符'),
    passed: T('每一家的预期都和查询结果相符。'),
  }
}
