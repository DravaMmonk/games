import { importProblem } from '../games/kit/engine/plugin-boundaries.js'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
// Lint for the games kit (../games/kit), run from the repository root: npm run lint:kit. Two things only: plain
// mistakes (undefined names, unused ones) and the layering (games/DIRECTION.md, decision 17) — a domain imports no
// other domain, and the kernel imports no domain (it loads one by name: engine/resolver.js).
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

const KIT = 'games/kit'
const root = resolve(import.meta.dirname, '..')
const packages = resolve(root, 'packages')
const packageIds = new Set(existsSync(packages)
  ? readdirSync(packages).filter(id => existsSync(resolve(packages, id, 'package.json'))) : [])

// These words also name kernel schema fields, result shapes and ordinary UI controls.
const optionalPackageNames = new Set(['wiki'])
const protocolWords = new Set(['text', 'rows', 'table', 'scalar', 'wiki', 'tick'])
const packageProperty = /^(?:package|packageId|packageIds|packages|uses|module|domain|layerOrder)$/
const packageCall = /(?:Package|Layer|Runtime|Module|Deps|Dependency|Plugin)$/
const propertyName = node => node?.name ?? node?.value
const kitBoundary = {
  create(context) {
    const imported = node => {
      const source = node.source ?? node.arguments[0]
      const name = source?.value ?? (source?.type === 'TemplateLiteral' ? source.quasis[0].value.cooked : '')
      if (typeof name !== 'string') return
      const target = name.startsWith('.') || name.startsWith('/') ? relative(root, resolve(dirname(context.filename), name)) : name
      if (/^(?:packages\/|[^:]*\/packages\/)/.test(target) || packageIds.has(name.split('/')[0])) {
        context.report({ node, message: 'The kernel must load packages through the public resolver.' })
      }
    }
    const literal = (node, value) => {
      if (typeof value !== 'string') return
      const [owner, member] = value.split('/')
      if (!packageIds.has(owner) && !optionalPackageNames.has(owner) || /^text\/(?:plain|html)$/.test(value)) return
      const parent = node.parent
      const packageContext = packageProperty.test(propertyName(parent.key ?? parent.id ?? parent.left?.property ?? parent.right?.property ?? parent.left ?? parent.right))
        || parent.type === 'CallExpression' && packageCall.test(propertyName(parent.callee.property ?? parent.callee))
        || context.sourceCode.getAncestors(node).some(ancestor => ancestor.type === 'Property' && packageProperty.test(propertyName(ancestor.key)))
      if (member !== undefined || !protocolWords.has(owner) || packageContext) {
        context.report({ node, message: `Package identity ${value} belongs in package data or code.` })
      }
    }
    return {
      ImportDeclaration: imported,
      ExportAllDeclaration: imported,
      ExportNamedDeclaration: node => { if (node.source) imported(node) },
      ImportExpression: imported,
      CallExpression: node => { if (node.callee.name === 'require') imported(node) },
      MemberExpression: node => { if (optionalPackageNames.has(propertyName(node.property))) literal(node.property, propertyName(node.property)) },
      Property: node => { if (node.key.type === 'Identifier' && optionalPackageNames.has(node.key.name)) literal(node.key, node.key.name) },
      Literal: node => literal(node, node.value),
      TemplateElement: node => literal(node, node.value.cooked),
    }
  },
}

export default defineConfig([
  globalIgnores(['**/node_modules', '**/versions']),
  {
    files: [`${KIT}/**/*.{js,jsx,mjs}`, 'packages/*/{core,view}/**/*.{js,jsx,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    // The hooks plugin is registered so the kit's existing directives for it resolve; its rules stay with the app's
    // own lint (eslint.config.js).
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', args: 'none', caughtErrors: 'none' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-irregular-whitespace': 'off',
      'no-control-regex': 'off',
      'no-regex-spaces': 'off',
      'require-yield': 'off',
    },
  },
  {
    files: [`${KIT}/**/*.{js,jsx,mjs}`],
    ignores: ['**/*.test.js', '**/test-fixture.js'],
    plugins: { kit: { rules: { 'package-boundary': kitBoundary } } },
    rules: { 'kit/package-boundary': 'error' },
  },
  {
    files: ['packages/*/{core,view}/**/*.{js,jsx,mjs}'],
    plugins: { packages: { rules: { boundary: { create(context) {
      const file = context.filename, root = file.slice(0, file.lastIndexOf('/packages/'))
      const id = file.slice(root.length + 10).split('/')[0]
      const uses = Object.keys(JSON.parse(readFileSync(resolve(root, 'packages', id, 'package.json'))).uses ?? {})
      const check = node => {
        const source = node.source ?? node.arguments?.[0]
        const message = importProblem(source?.type === 'Literal' ? source.value : null, file, root, uses)
        if (message) context.report({ node, message })
      }
      return { ImportDeclaration: check, ExportAllDeclaration: check, ExportNamedDeclaration: node => { if (node.source) check(node) }, ImportExpression: check,
        CallExpression: node => { if (node.callee?.name === 'require') check(node) },
        JSXElement: node => { if (file.includes('/core/')) context.report({ node, message: 'core cannot contain JSX' }) },
      }
    } } } } },
    rules: { 'packages/boundary': 'error' },
  },
])
