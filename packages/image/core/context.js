import { createTaskContext } from 'circuit'
import runtime from './runtime.js'
import { imageWorks } from './work.js'

export const imageContext = createTaskContext('image', runtime, imageWorks)
