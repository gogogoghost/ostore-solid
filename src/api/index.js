// Backend facade.
//
// OStore prefers the Sideload remote service, then Flipfull's bridge, and falls
// back to the legacy appscmd HTTP daemon, so a new OStore keeps working on systems
// without either (and on systems where the application was not granted `sideload`).
import * as http from './api'
import * as sideload from './sideload'
import * as flipfull from './flipfull'
import { saveFile } from '../libs/utils.js'

// Backend independent helpers (the store servers, not appscmd).
export { getAllList, getPopularList, resourceUrl, baseUrl, proxyBaseUrl } from './api'

const backends = { sideload, flipfull, http }

let activeBackend = 'http'

export function getBackend() {
  return activeBackend
}

/// Detects Sideload, then Flipfull, once at startup; never throws, falls back to HTTP.
export async function detectBackend() {
  for (const name of ['sideload', 'flipfull']) {
    try {
      await backends[name].probe()
      activeBackend = name
      console.log(`[ostore] using the ${name} backend`)
      return activeBackend
    } catch (error) {
      console.log(`[ostore] ${name} unavailable:`, String((error && error.message) || error))
    }
  }
  activeBackend = 'http'
  console.log('[ostore] using the HTTP backend')
  return activeBackend
}

// Runs a call on the active backend. Service availability errors switch to HTTP
// for this call; service level errors (a failed install, ...) are propagated unchanged.
async function run(call) {
  if (activeBackend !== 'http') {
    try {
      return await call(backends[activeBackend])
    } catch (error) {
      if (!error || !error.kaiExtUnavailable) {
        throw error
      }
      console.log(`[ostore] ${activeBackend} call failed, falling back to HTTP:`, error.message)
      activeBackend = 'http'
    }
  }
  return call(http)
}

export function getList() {
  return run((backend) => backend.getList())
}

export function install(packagePath) {
  return run((backend) => backend.install(packagePath))
}

// Installs a store entry. Flipfull downloads it itself, the other backends get
// a copy on the memory card. onStep(message) reports progress.
export function installFromStore(item, onStep = () => {}) {
  let path = null
  return run(async (backend) => {
    if (backend.installFromStore) {
      return backend.installFromStore(item.url, item.id, onStep)
    }
    if (!path) {
      onStep('Downloading...')
      const res = await (await fetch(item.url)).blob()
      path = await saveFile(res, item.fileName)
    }
    onStep('Installing...')
    return backend.install(path)
  })
}

export function installPWA(manifestUrl) {
  return run((backend) => backend.installPWA(manifestUrl))
}

export function uninstall(manifestUrl) {
  return run((backend) => backend.uninstall(manifestUrl))
}

export function getAppFile(origin, path) {
  return run((backend) => backend.getAppFile(origin, path))
}

export function getAppManifest(origin) {
  return run((backend) => backend.getAppManifest(origin))
}
