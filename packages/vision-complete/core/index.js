import { displayItems, extendVocabulary } from 'image'
import { imageItems } from './image-items.js'
export function register(kernel) {
  kernel.kind('vision-complete/imageItems', {
    type: 'level', read: value => value, derived: ['imageItems'],
    assemble: () => ({ imageItems }),
    vocabulary(base) {
      const items = (all, schema) => Object.fromEntries(Object.entries(all).map(([name, item]) => [name, schema(item)]))
      return extendVocabulary(base, { module: 'vision-complete', kinds: {
        scene: items(imageItems.scenes, item => ({ about: item.about, params: item.setup, test: item.test })),
        benchModel: items(imageItems.benches, item => ({ about: item.about, params: item.setup, stage: item.stage, case: item.case })),
        display: Object.fromEntries(Object.entries(displayItems(imageItems.displays)).filter(([name]) => name.startsWith('vision-complete/'))),
      } })
    },
  })
}
