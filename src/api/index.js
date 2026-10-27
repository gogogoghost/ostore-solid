// Backend facade.
//
// One install mode is detected on first launch, persisted, and reused. Each
// mode installs the same catalogue entry differently: AppsManager consumes the
// signed update pointer, while Sideload, Flipfull, and appscmd install the
// unsigned ZIP. Manual ZIP installs always use a local mode.
import * as http from './api'
import * as sideload from './sideload'
import * as flipfull from './flipfull'
import * as appsmanager from './appsmanager'
import { saveFile } from '../libs/utils.js'
import { systemFetch } from '../libs/systemFetch.js'
import {
  MODES, MODE_IDS, LOCAL_MODE_IDS,
  loadModeState, saveModeState, chooseMode, normalizeAvailable,
  runWithFallback,
} from './modes'

export { getAllList, getPopularList } from './catalog'
export { errorText } from './appsmanager'
export { MODES } from './modes'

const backends = { appsmanager, sideload, flipfull, appscmd: http }
const PROBE_TIMEOUT = 20000

let activeMode = MODE_IDS[0]
let availableModes = []
let detected = false
let detection = null

function restoreMode() {
  const state = loadModeState()
  if (!state.mode) return false
  activeMode = state.mode
  availableModes = state.available
  detected = true
  return true
}

function saveMode() {
  saveModeState(activeMode, availableModes)
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} probe timed out`)), ms)
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

async function probeMode(mode) {
  const backend = backends[mode]
  if (typeof backend?.probe !== 'function') {
    throw new Error(`${mode} has no probe`)
  }
  await withTimeout(backend.probe(), PROBE_TIMEOUT, mode)
}

async function probeAll() {
  const results = await Promise.all(MODE_IDS.map(async mode => {
    try {
      await probeMode(mode)
      return mode
    } catch (error) {
      console.log(`[ostore] ${mode} unavailable:`, String((error && error.message) || error))
      return null
    }
  }))
  availableModes = normalizeAvailable(results.filter(Boolean))
  activeMode = chooseMode(availableModes, activeMode)
  detected = true
  saveMode()
  console.log('[ostore] install modes available:',
    availableModes.join(', ') || 'none', 'using', activeMode)
  return activeMode
}

// A saved mode is used directly on later launches; only the first launch, or
// an explicit re-detect from Settings, probes the backends.
export function detectInstallMode(force = false) {
  if (!force && detected) return Promise.resolve(activeMode)
  if (!force && restoreMode()) return Promise.resolve(activeMode)
  if (detection) return detection
  detection = probeAll().finally(() => { detection = null })
  return detection
}

export function getInstallMode() {
  return activeMode
}

export function getAvailableModes() {
  return [...availableModes]
}

export function setInstallMode(mode) {
  if (!MODE_IDS.includes(mode)) {
    throw new Error('Unknown install mode: ' + mode)
  }
  activeMode = mode
  saveMode()
  return activeMode
}

function isUnavailable(error) {
  if (!error) return false
  if (error.kaiExtUnavailable) return true
  if (appsmanager.isUnavailable(error)) return true
  return /^appscmd request failed/.test(String(error.message || error))
}

function dropMode(mode) {
  availableModes = availableModes.filter(id => id !== mode)
  if (activeMode === mode) {
    activeMode = availableModes[0] || MODE_IDS.find(id => id !== mode) || mode
  }
  saveMode()
}

function markSuccess(mode) {
  if (!MODE_IDS.includes(mode)) return
  if (mode === activeMode && availableModes.includes(mode)) return
  availableModes = normalizeAvailable([...availableModes, mode])
  activeMode = mode
  saveMode()
}

function attemptOrder(values) {
  return values.filter((value, index) =>
    MODE_IDS.includes(value) && values.indexOf(value) === index)
}

function defaultOrder() {
  return attemptOrder([activeMode, ...availableModes, ...MODE_IDS])
}

function localOrder() {
  return attemptOrder([activeMode, ...availableModes, ...LOCAL_MODE_IDS])
    .filter(mode => LOCAL_MODE_IDS.includes(mode))
}

async function runMode(call, order = defaultOrder()) {
  return runWithFallback(order, async mode => {
    const result = await call(backends[mode], mode)
    markSuccess(mode)
    return result
  }, isUnavailable, (mode, error) => {
    console.log(`[ostore] ${mode} unavailable:`, String((error && error.message) || error))
    dropMode(mode)
  })
}

async function runMethod(method, args, order = defaultOrder()) {
  return runMode(async (backend, mode) => {
    if (typeof backend?.[method] !== 'function') {
      const error = new Error(`${mode} cannot ${method}`)
      error.kaiExtUnavailable = true
      throw error
    }
    return backend[method](...args)
  }, order)
}

function installSigned(item, onStep) {
  onStep('Installing...')
  if (item.installedVersion && item.manifestUrl && item.versionState === 1 &&
      item.installedUpdateUrl === item.signedUpdateUrl) {
    return appsmanager.updatePackage(item.signedUpdateUrl, item.manifestUrl)
  }
  return appsmanager.installPackage(item.signedUpdateUrl)
}

async function installUnsigned(backend, item, onStep) {
  if (typeof backend.installFromStore === 'function') {
    return backend.installFromStore(item.url, item.id, onStep)
  }
  onStep('Downloading...')
  const response = await systemFetch(item.url)
  if (response.type === 'opaque' || !response.ok) {
    throw new Error(`HTTP ${response.status} at ${item.url}`)
  }
  const path = await saveFile(await response.blob(), item.fileName)
  onStep('Installing...')
  return backend.install(path)
}

restoreMode()

export function installFromStore(item, onStep = () => {}) {
  if (!item?.signedUpdateUrl || !item?.url || !item?.fileName) {
    return Promise.reject(new Error('Incomplete catalogue entry'))
  }
  return runMode((backend, mode) => (
    mode === 'appsmanager'
      ? installSigned(item, onStep)
      : installUnsigned(backend, item, onStep)
  ))
}

// Manual ZIPs cannot use AppsManager; pick any available local mode instead.
export function install(packagePath) {
  const order = localOrder()
  const detected = order.some(mode => mode === activeMode || availableModes.includes(mode))
  if (availableModes.length && !detected) {
    return Promise.reject(new Error(
      'AppsManager cannot install a local ZIP. Select Sideload, Flipfull, or appscmd in About.'))
  }
  return runMethod('install', [packagePath], order)
}

export function installPWA(manifestUrl) {
  return runMethod('installPWA', [manifestUrl])
}

export function uninstall(manifestUrl) {
  return runMethod('uninstall', [manifestUrl])
}

export function getList() {
  return runMethod('getList', [])
}

export function getAppFile(origin, path) {
  return runMethod('getAppFile', [origin, path])
}

export function getAppManifest(origin) {
  return runMethod('getAppManifest', [origin])
}
