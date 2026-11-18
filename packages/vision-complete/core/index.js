import { imageItems } from './image-items.js'

export function register(kernel) {
  for (const [name, scene] of Object.entries(imageItems.scenes)) kernel.implement('image/scene', name, scene)
  for (const [name, bench] of Object.entries(imageItems.benches)) kernel.implement('benchModel', name, bench)
}
