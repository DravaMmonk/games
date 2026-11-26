// Every page of the built site registers the one service worker at the site's root (./offline-build.js).
export function registerOffline(root) {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(new URL('sw.js', root))
}
