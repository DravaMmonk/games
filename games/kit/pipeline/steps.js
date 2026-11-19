import { runtimeIds } from '../engine/runtime.js'
// The agent pipeline's steps (games/DIRECTION.md 4, games/design/README.md 7.2), the same for every topic: what each step
// reads and writes, who does it, the commands its agent gets, and the gate that decides it is done. Every gate's
// failure names one rule; a step's product is content written through the operation set.
//
//   blueprint  curriculum designer   writes blueprint.json            gate: the blueprint audit (blueprint.js)
//   domain     engineer (code)       resolves the blueprint's requests gate: no request open, contract, check, tests
//   levels     level designer        writes levels, eras, primitives  gate: npm run check + conformance to the blueprint
//                                                                            (encyclopedia entries are checked in the copy step) + the pedagogy lint
//   copy       copy writer           rewrites every text, glossary    gate: check + conformance + encyclopedia link validation
//                                                                            + the pedagogy lint
//   review     reviewer              reads it all, reports findings   gate: no finding to fix left open
//   queue      —                     the review queue entry           gate: every gate above still clean
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkGame } from '../engine/checks.js'
import { runtimeOf, readContent, packageDirectory } from '../engine/resolver.js'
import { specProblems, validateProblems } from '../engine/contract.js'
import { auditBlueprint, conformance } from './blueprint.js'
import { lintPedagogy } from './pedagogy.js'
import { reviewTerminology } from './terminology.js'
import { searchable } from '../engine/ops/search.js'
import { checkContent } from '../engine/vocabulary.js'
import { meaningsOf } from '../engine/kind-meanings.js'
import { isLanguageCode } from '../engine/i18n.js'
import { testArgs, testEnv, testFiles } from '../engine/test-files.js'

const finding = (rule, at, says) => ({ rule, at, says })

/** Reuse authoring checks within one gate invocation, including all steps of a queue run. */
function inspectionOf(id) {
  const content = readContent(id)
  const results = new Map()
  const once = (name, run) => {
    if (!results.has(name)) results.set(name, run())
    return results.get(name)
  }
  const domain = () => once('runtime', () => runtimeOf(content))
  const spec = () => once('spec', async () => (await domain()).spec(content))
  const noBlueprint = () => finding('bp-missing', id, 'the game has no blueprint.json')
  return {
    id, content, domain, spec, noBlueprint,
    checks: () => once('check', async () => {
      const lines = await checkGame(content, { domain: await domain() })
      return lines.filter(line => line.fail).map(line => finding('check', line.level ?? id, line.text))
    }),
    conformance: () => once('conformance', async () => content.blueprint
      ? conformance(content.blueprint, content, await spec())
      : [noBlueprint()]),
    pedagogy: () => once('pedagogy', async () => splitFindings(lintPedagogy(content, await spec()))),
    terminology: () => once('terminology', async () => reviewTerminology(content, await spec(), (await domain()).vocabulary)),
  }
}

const splitFindings = findings => ({
  failures: findings.filter(item => !item.report),
  reports: findings.filter(item => item.report),
})

export const pedagogyOf = id => inspectionOf(id).pedagogy()
export const terminologyOf = id => inspectionOf(id).terminology()
export const gateOf = (step, id, state, scope) => step.gate(inspectionOf(id), state, scope)

/** The last run of a step recorded in the game's pipeline state. */
const lastRun = (state, step) => state.steps?.[step]?.runs?.at(-1) ?? null

export const STEPS = [
  {
    id: 'blueprint',
    who: 'agent',
    role: 'curriculum designer',
    commands: ['op', 'check', 'gate'],
    gate: async ({ content, noBlueprint }) => content.blueprint
      ? splitFindings(auditBlueprint(content.blueprint))
      : { failures: [noBlueprint()], reports: [] },
  },
  {
    id: 'domain',
    who: 'engineer',
    role: 'engineer',
    gate: async (inspection) => {
      const { content } = inspection
      const open = (content.blueprint?.requests ?? []).filter((r) => r.status === 'open').map((r) => finding('request-open', r.id, r.about.en ?? r.about))
      const domain = await inspection.domain()
      const spec = await inspection.spec()
      const owners = runtimeIds(content)
      const contract = [...specProblems(domain, content, spec), ...await validateProblems(domain, content, spec)]
        .map((problem) => finding('contract', owners.join(', '), problem))
      const tests = []
      for (const owner of owners) {
        const files = testFiles(resolve(packageDirectory(owner), 'test'))
        if (!files.length) continue
        try {
          execFileSync(process.execPath, testArgs(files), { stdio: 'pipe', env: testEnv() })
        } catch (error) {
          const failures = String(error.stdout ?? error.message).split('\n').filter(line => line.startsWith('not ok'))
          tests.push(finding('package-test', owner, failures.join('\n') || 'its unit tests fail'))
        }
      }
      return { failures: [...open, ...contract, ...tests, ...await inspection.checks()], reports: [] }
    },
  },
  {
    id: 'levels',
    who: 'agent',
    role: 'level designer',
    commands: ['op', 'check', 'gate', 'deps', 'eras', 'pedagogy'],
    gate: async (inspection) => {
      const pedagogy = await inspection.pedagogy()
      return { failures: [...await inspection.checks(), ...(await inspection.conformance()).filter((f) => f.rule !== 'bp-entry'), ...pedagogy.failures], reports: pedagogy.reports }
    },
  },
  {
    id: 'copy',
    who: 'agent',
    role: 'copy writer',
    commands: ['op', 'check', 'gate', 'pedagogy', 'terminology'],
    gate: async (inspection) => {
      const pedagogy = await inspection.pedagogy()
      const terms = await inspection.terminology()
      return { failures: [...await inspection.checks(), ...(await inspection.conformance()), ...pedagogy.failures, ...terms.failures], reports: pedagogy.reports }
    },
  },
  {
    id: 'review',
    who: 'agent',
    role: 'reviewer',
    commands: ['check', 'deps', 'pedagogy', 'terminology'],
    gate: async (inspection, state) => {
      const { id } = inspection
      const terms = await inspection.terminology()
      const run = lastRun(state, 'review')
      if (!run?.findings) return { failures: [...terms.failures, finding('review-missing', id, 'no review has run')], reports: [] }
      const open = run.findings.filter((f) => f.fix && !f.resolved)
      return { failures: [...terms.failures, ...open.map((f) => finding('review', f.at, `${f.owner}: ${f.says}`))], reports: run.findings.filter((f) => !f.fix).map((f) => finding('review-note', f.at, f.says)) }
    },
  },
  {
    // Translation is its own work (games/DIRECTION.md, decision 20): it follows the copy, holds nothing up (`aside`:
    // the queue does not wait for it) and is asked for a language at a time (run translate --scope <lang>).
    id: 'translate',
    who: 'agent',
    role: 'translator',
    aside: true,
    commands: ['op', 'check', 'gate'],
    gate: async (inspection, _state, scope) => {
      const { content } = inspection
      const domain = await inspection.domain()
      const vocabulary = meaningsOf(domain.vocabulary).reduce((vocabulary, meaning) => meaning.validationVocabulary?.({ vocabulary, content }) ?? vocabulary, domain.vocabulary)
      const places = searchable(content, vocabulary, ['text']).filter((p) => p.side)
      const field = (place) => JSON.stringify([place.file, place.path])
      const fields = new Set(places.map(field)).size
      const languages = scope ? [scope] : [...new Set(places.map((p) => p.side))]
      return {
        failures: [
          ...checkContent(domain, content).map((p) => finding('content', p.at, p.says)),
          ...(scope && !isLanguageCode(scope) ? [finding('i18n-locale', scope, 'expected a language code')] : []),
        ],
        reports: languages.filter(isLanguageCode).flatMap((lang) => {
          const filled = new Set(places.filter((p) => p.side === lang && p.text.trim()).map(field)).size
          return filled < fields ? [finding('i18n-missing', lang, `${fields - filled} of ${fields} fields have no text in this language`)] : []
        }),
      }
    },
  },
  {
    id: 'queue',
    who: 'pipeline',
    role: 'pipeline',
    gate: async (inspection, state) => {
      const failures = []
      const seen = new Set()
      for (const step of STEPS.filter(step => step.id !== 'queue' && !step.aside)) {
        const result = await step.gate(inspection, state)
        for (const issue of result.failures) {
          const key = JSON.stringify([issue.rule, issue.at, issue.says])
          if (seen.has(key)) continue
          seen.add(key)
          failures.push({ ...issue, rule: `${step.id}:${issue.rule}` })
        }
      }
      return { failures, reports: [] }
    },
  },
]

export const stepOf = (id) => STEPS.find((s) => s.id === id) ?? null
export const briefOf = (step) => readFileSync(resolve(import.meta.dirname, 'steps', `${step}.md`), 'utf8')
