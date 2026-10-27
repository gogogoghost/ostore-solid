// KaiOS 3 AppsManager client. Its generated URL encoder differs by firmware:
// some builds accept a string and others a URL object. Inspect the local
// encoder before sending an action, then retry only a proven argument-type
// error. A service failure may mean the action has already started.
import { loadScript } from '../libs/loadScript.js'
import { systemFetch } from '../libs/systemFetch.js'

const ROOT = 'http://127.0.0.1/api/v1/'
const SCRIPT_PATHS = ['shared/core.js', 'shared/session.js', 'apps/service.js']
const REQUEST_FIELDS = {
  installPackage: ['InstallPackageRequest', 'updateUrl'],
  checkForUpdate: ['CheckForUpdateRequest', 'updateUrl'],
  update: ['UpdateRequest', 'manifestUrl'],
  installPwa: ['InstallPwaRequest', 'manifestUrl'],
  uninstall: ['UninstallRequest', 'manifestUrl'],
}

let managerPromise = null
let lastDownloadFailure = null

// AppsManager can reject with an AppsServiceError value rather than an Error.
// Match the reference AppsManager helper so the phone displays the service code
// instead of alerting an undefined .message.
function describeError(error) {
  const value = error?.value
  const code = [error, value, value?.error, error?.code, error?.error]
    .find(candidate => typeof candidate === 'number')
  const names = globalThis.lib_apps?.AppsServiceError
  const name = code === undefined ? '' : Object.keys(names || {})
    .find(key => names[key] === code) || `code ${code}`
  const details = [name, error?.reason, error?.message,
    typeof value === 'string' ? value : '']
    .filter(part => part !== undefined && part !== null && part !== '')
    .map(String)
  if (details.length) return [...new Set(details)].join(': ')
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object') {
    try {
      const json = JSON.stringify(error)
      if (json && json !== '{}') return json
    } catch (_) { /* Use the fallback below for cyclic service objects. */ }
  }
  return 'AppsManager returned no error details'
}

export function errorText(error, includeDownloadFailure = false) {
  const detail = describeError(error)
  if (!includeDownloadFailure || lastDownloadFailure === null) return detail
  const downloadDetail = describeError(lastDownloadFailure)
  return downloadDetail === detail ? detail : `${detail}; download failed: ${downloadDetail}`
}

function watchDownloadFailures(manager) {
  if (typeof manager?.addEventListener !== 'function' ||
      manager.APP_DOWNLOAD_FAILED_EVENT === undefined) return
  try {
    manager.addEventListener(manager.APP_DOWNLOAD_FAILED_EVENT, event => {
      lastDownloadFailure = event?.reason ?? event?.value ?? event
      console.warn('[ostore] AppsManager download failed:', event)
    })
  } catch (error) {
    console.warn('[ostore] AppsManager download event unavailable:', error)
  }
}

async function connect() {
  if (managerPromise) return managerPromise
  managerPromise = (async () => {
    for (const path of SCRIPT_PATHS) await loadScript(ROOT + path)
    if (!globalThis.lib_session?.Session || !globalThis.lib_apps?.AppsManager) {
      throw new Error('AppsManager client scripts are unavailable')
    }
    const token = typeof navigator.b2g?.externalapi?.getToken === 'function'
      ? await navigator.b2g.externalapi.getToken() : 'secrettoken'
    return new Promise((resolve, reject) => {
      const session = new globalThis.lib_session.Session()
      let settled = false
      const timer = setTimeout(() => finish(new Error('AppsManager connection timed out')), 12000)
      function finish(error, manager) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) reject(error)
        else {
          watchDownloadFailures(manager)
          resolve(manager)
        }
      }
      try {
        session.open('websocket', 'localhost', token, {
          onsessionconnected() {
            globalThis.lib_apps.AppsManager.get(session).then(
              manager => finish(null, manager), finish
            )
          },
          onsessiondisconnected() {
            managerPromise = null
            finish(new Error('AppsManager session disconnected'))
          },
          onsessionconnectionerror() {
            finish(new Error('AppsManager session connection error'))
          },
        }, true)
      } catch (error) { finish(error) }
    })
  })().catch(error => {
    managerPromise = null
    throw error
  })
  return managerPromise
}

export function callUrlMethod(manager, method, rawUrl, rest = []) {
  if (typeof manager?.[method] !== 'function') {
    return Promise.reject(new Error(`AppsManager.${method} is unavailable`))
  }
  const address = new URL(String(rawUrl)).href
  if (!/^https?:$/.test(new URL(address).protocol)) {
    return Promise.reject(new Error('AppsManager needs an HTTP(S) URL'))
  }
  const request = REQUEST_FIELDS[method]
  const codec = request && manager.wrapper_payload_message?.[request[0]]
  const extra = method === 'checkForUpdate' ? { appsOption: rest[0] } : {}
  const accepts = value => {
    if (typeof codec?.encode !== 'function') return false
    try {
      codec.encode({ [request[1]]: value, ...extra })
      return true
    } catch (_) { return false }
  }
  const asObject = new URL(address)
  const first = !accepts(address) && accepts(asObject) ? asObject : address
  const call = value => Promise.resolve().then(() => manager[method](value, ...rest))
  return call(first).catch(error => {
    const message = String(error?.message || error || '')
    if (typeof first === 'string' &&
        /Expected\s+URL\s*,\s*(?:bug\s+|but\s+)?got\s+string/i.test(message)) {
      return call(asObject)
    }
    if (typeof first !== 'string' &&
        /Expected\s+string\s*,\s*(?:bug\s+|but\s+)?got\s+(?:object|URL)/i.test(message)) {
      return call(address)
    }
    throw error
  })
}

export async function probe() {
  const manager = await connect()
  await manager.getAll()
  return true
}
export async function getAll() { return (await connect()).getAll() }
export async function installPackage(updateUrl) {
  lastDownloadFailure = null
  return callUrlMethod(await connect(), 'installPackage', updateUrl)
}
export async function installPWA(manifestUrl) {
  return callUrlMethod(await connect(), 'installPwa', manifestUrl)
}
export async function uninstall(manifestUrl) {
  return callUrlMethod(await connect(), 'uninstall', manifestUrl)
}
export async function updatePackage(updateUrl, manifestUrl) {
  lastDownloadFailure = null
  const manager = await connect()
  const available = await callUrlMethod(manager, 'checkForUpdate', updateUrl, [{ autoInstall: false }])
  if (!available) throw new Error('No update is available at this app’s installed update URL')
  return callUrlMethod(manager, 'update', manifestUrl)
}

// --- installed app listing and local vhost content -------------------------

function manifestUrlOf(app) {
  const direct = app?.manifestUrl || app?.manifestURL || app?.manifest_url
  if (typeof direct === 'string' && direct) return direct
  const origin = String(app?.origin || app?.id || '')
  if (!origin) return ''
  const host = origin.includes('.') ? origin : `${origin}.localhost`
  return `http://${host}/manifest.webmanifest`
}

function toInstalledApp(app) {
  const origin = String(app?.origin || app?.id || '')
  return {
    id: String(app?.id || origin || app?.name || ''),
    name: String(app?.name || app?.id || origin || 'Unknown'),
    version: String(app?.version || ''),
    source: origin,
    protected: app?.removable === false || app?.protected === true,
    manifest_url: manifestUrlOf(app),
    update_url: app?.updateUrl || app?.updateURL || app?.update_url || '',
  }
}

export async function getList() {
  const apps = await getAll()
  if (!Array.isArray(apps)) throw new Error('AppsManager returned no application list')
  return apps.map(toInstalledApp).filter(app => app.manifest_url)
}

function localUrl(target) {
  const value = String(target)
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '')
  return 'http://' + value.replace(/\/+$/, '')
}

export async function getAppManifest(target) {
  const urls = /^https?:\/\//i.test(String(target))
    ? [String(target)]
    : ['manifest.webmanifest', 'manifest.webapp'].map(name => `${localUrl(target)}/${name}`)
  for (const url of urls) {
    try {
      const response = await systemFetch(url)
      if (response.type === 'opaque' || !response.ok) continue
      return await response.json()
    } catch (_) { /* Try the next manifest name. */ }
  }
  throw new Error('unable to read manifest of ' + target)
}

export async function getAppFile(origin, path) {
  const url = localUrl(origin) + (path.startsWith('/') ? path : '/' + path)
  const response = await systemFetch(url)
  if (response.type === 'opaque') throw new Error('request was blocked')
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return new Uint8Array(await response.arrayBuffer())
}

export function isUnavailable(error) {
  const text = errorText(error) + ' ' + String(error?.message || error || '')
  return /MissingPermission|AppsManager (client scripts are unavailable|connection timed out|session disconnected|session connection error)|Could not load|Timed out loading|UnknownService/i.test(text)
}

// AppsManager retains the source update URL when it installs a package. Look
// up our own record rather than baking a release server into the application.
export function findOwnApp(apps) {
  return (apps || []).find(app => {
    if (app?.origin === 'ostore') return true
    const manifestUrl = app?.manifestUrl || app?.manifestURL || app?.manifest_url
    try { return new URL(manifestUrl).hostname === 'ostore.localhost' }
    catch (_) { return false }
  })
}

export async function checkOwnUpdateWithManager(manager, confirmUpdate) {
  const own = findOwnApp(await manager.getAll())
  if (!own) return false
  const updateUrl = own.updateUrl || own.updateURL || own.update_url
  const manifestUrl = own.manifestUrl || own.manifestURL || own.manifest_url
  if (!updateUrl || !manifestUrl) return false
  lastDownloadFailure = null
  const available = await callUrlMethod(manager, 'checkForUpdate', updateUrl, [{ autoInstall: false }])
  if (!available || !confirmUpdate('An OStore update is available. Install it now?')) return false
  await callUrlMethod(manager, 'update', manifestUrl)
  return true
}

export async function checkOwnUpdate(confirmUpdate = message => globalThis.confirm(message)) {
  return checkOwnUpdateWithManager(await connect(), confirmUpdate)
}
