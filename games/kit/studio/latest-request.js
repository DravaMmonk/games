/** Run one request at a time, replacing any waiting request with the newest one. */
export function latestRequest() {
  let running = false
  let waiting
  return async (request) => {
    waiting = request
    if (running) return
    running = true
    try {
      while (waiting) {
        const next = waiting
        waiting = null
        await next()
      }
    } finally {
      running = false
    }
  }
}
