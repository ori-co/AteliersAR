import * as ecs from '@8thwall/ecs'

// Bridges image target tracking to the HTML overlay (index.html) as DOM events:
// 'ar-image-found' / 'ar-image-lost' on window, with the target name in `detail`.
// A world behavior, so it needs no entity in the scene.
let bound = false

ecs.registerBehavior((world) => {
  if (bound) return
  bound = true
  const forward = (type: string) => (e: any) => {
    console.log(`[target-events] ${type}`, e?.data?.name)
    window.dispatchEvent(new CustomEvent(type, {detail: e?.data?.name}))
  }
  world.events.addListener(world.events.globalId, ecs.events.REALITY_IMAGE_FOUND, forward('ar-image-found'))
  world.events.addListener(world.events.globalId, ecs.events.REALITY_IMAGE_LOST, forward('ar-image-lost'))
})
