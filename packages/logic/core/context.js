import { createTaskContext } from 'circuit'
import runtime from './runtime.js'
import { logicWorks } from './work.js'

export const logicContext = createTaskContext('logic', runtime, logicWorks)
