// Backend facade.
//
// OStore prefers the Sideload remote service and falls back to the legacy appscmd
// HTTP daemon, so a new OStore keeps working on systems without the Sideload
// patch (and on systems where the application was not granted `sideload`).
import * as http from './api'
import * as sideload from './sideload'

// Backend independent helpers (the store servers, not appscmd).
export { getAllList, getPopularList, resourceUrl, baseUrl, proxyBaseUrl } from './api'

let activeBackend = 'http'

export function getBackend() {
  return activeBackend
}

/// Detects Sideload once at startup; never throws, falls back to HTTP.
export async function detectBackend() {
  try {
    await sideload.probe()
    activeBackend = 'sideload'
    console.log('[ostore] using the Sideload backend')
  } catch (error) {
    activeBackend = 'http'
    console.log('[ostore] Sideload unavailable, using the HTTP backend:', String((error && error.message) || error))
  }
  return activeBackend
}

// Runs a call on the active backend. Service availability errors from Sideload
// switch to HTTP for this call; service level errors (a failed install, ...)
// are propagated unchanged.
async function run(sideloadCall, httpCall) {
  if (activeBackend === 'sideload') {
    try {
      return await sideloadCall()
    } catch (error) {
      if (!error || !error.kaiExtUnavailable) {
        throw error
      }
      console.log('[ostore] Sideload call failed, falling back to HTTP:', error.message)
      activeBackend = 'http'
    }
  }
  return httpCall()
}

export function getList() {
  return run(() => sideload.getList(), () => http.getList())
}

export function install(packagePath) {
  return run(() => sideload.install(packagePath), () => http.install(packagePath))
}

export function installPWA(manifestUrl) {
  return run(() => sideload.installPWA(manifestUrl), () => http.installPWA(manifestUrl))
}

export function uninstall(manifestUrl) {
  return run(() => sideload.uninstall(manifestUrl), () => http.uninstall(manifestUrl))
}

export function getAppFile(origin, path) {
  return run(() => sideload.getAppFile(origin, path), () => http.getAppFile(origin, path))
}

export function getAppManifest(origin) {
  return run(() => sideload.getAppManifest(origin), () => http.getAppManifest(origin))
}
