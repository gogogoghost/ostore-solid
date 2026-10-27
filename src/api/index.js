// Backend facade.
//
// Hosted JScalated packages use AppsManager. OStore ZIPs and manual installs
// retain Sideload, Flipfull, and appscmd in their existing priority order.
import * as http from './api'
import * as sideload from './sideload'
import * as flipfull from './flipfull'
import * as appsmanager from './appsmanager'
import { saveFile } from '../libs/utils.js'

export { getAllList, getPopularList, DEFAULT_SOURCES } from './catalog'
export { resourceUrl, baseUrl, proxyBaseUrl } from './api'
export { errorText } from './appsmanager'
import { downloadOStorePackage } from './catalog'

const backends = { sideload, flipfull, http }

let activeBackend = 'http'

export function getBackend() {
  return activeBackend
}

// AppsManager connects when a hosted package is selected. Startup detection
// retains the existing Sideload, then Flipfull, then HTTP order for ZIPs.
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

// JScalated entries publish update manifests. OStore entries publish ZIPs:
// Flipfull downloads those itself; the other backends use a local copy.
export function installFromStore(item, onStep = () => {}) {
  if (item.source === 'jscalated') {
    onStep('Installing...')
    if (item.installKind === 'pwa') {
      return appsmanager.installPWA(item.pwaManifestUrl)
    }
    if (item.installedVersion && item.manifestUrl) {
      return appsmanager.updatePackage(item.installedUpdateUrl || item.updateUrl, item.manifestUrl)
    }
    return appsmanager.installPackage(item.updateUrl)
  }
  let path = null
  return run(async (backend) => {
    if (backend.installFromStore) {
      return backend.installFromStore(item.url, item.id, onStep)
    }
    if (!path) {
      onStep('Downloading...')
      const res = await downloadOStorePackage(item)
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
