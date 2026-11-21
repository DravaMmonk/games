/* global process */
import { TOOLS } from './tools.js'

const args = process.argv.slice(2)
const target = args[0] === '--package' ? { package: args.splice(0, 2)[1] } : { game: args.shift() }
const [selector] = args
const match = /^(chapter|level)=(.+)$/.exec(selector ?? '')

try {
  if (args.length > 1 || selector !== undefined && !match) {
    throw new Error('usage: npm run --silent inspect -- (<game> | --package <package>) [chapter=… | level=…]')
  }
  const result = await TOOLS.inspect.run({ ...target, ...(match && { [match[1]]: match[2] }) })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
