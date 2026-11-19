import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalogReader } from '../../../games/kit/engine/catalogs.js'
import { objectFiles, readCatalogs } from '../../../games/kit/engine/resolver.js'

const directory = join(import.meta.dirname, 'fixtures')
const read = catalogReader(readCatalogs(join(directory, 'i18n')))

export const logicParts = { parts: Object.fromEntries(objectFiles(directory, 'parts').map(([name, path]) => [
  name, read(JSON.parse(readFileSync(path, 'utf8'))),
])) }
