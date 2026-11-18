import { resourcePlaySchema } from 'kernel'

export { holeTree, treeKey } from './tree.js'
export const sentencePlaySchema = resourcePlaySchema('sentence', ['check'])

export function register() {}
