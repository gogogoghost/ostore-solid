// Flipfull backend.
//
// On a TCL Flip 4 with Flipfull, OStore installs through Flipfull's bridge
// service. Flipfull downloads the zip itself and checks it before installing.
import { loadScript } from '../libs/loadScript.js'
import { systemFetch } from '../libs/systemFetch.js'

const SCRIPTS = [
  'http://127.0.0.1/api/v1/shared/core.js',
  'http://127.0.0.1/api/v1/shared/session.js',
  'http://127.0.0.1/flipfull/bridge.js',
]

let bridgePromise = null

function bridge() {
  if (!bridgePromise) {
    bridgePromise = (async () => {
      for (const src of SCRIPTS) await loadScript(src)
      if (!window.FlipfullBridge) {
        throw new Error('FlipfullBridge missing')
      }
      return window.FlipfullBridge
    })()
    bridgePromise.catch(() => {
      bridgePromise = null
    })
  }
  return bridgePromise
}

function unavailableError(error) {
  const wrapped = new Error('Flipfull unavailable: ' + ((error && error.message) || error))
  wrapped.kaiExtUnavailable = true
  return wrapped
}

function failure(error) {
  if (error && error.offline) {
    return unavailableError(error)
  }
  const message = String((error && error.message) || error).replace(/^error: /, '')
  return new Error(message.charAt(0).toUpperCase() + message.slice(1))
}

async function store(...words) {
  let service
  try {
    service = await bridge()
  } catch (error) {
    throw unavailableError(error)
  }
  try {
    return await service.run(...words)
  } catch (error) {
    throw failure(error)
  }
}

async function get(url, responseType) {
  const res = await systemFetch(url)
  if (res.type === 'opaque') {
    throw new Error('request was blocked')
  }
  if (!res.ok) {
    throw new Error('HTTP ' + res.status)
  }
  return responseType === 'json' ? res.json() : res.arrayBuffer()
}

export async function probe() {
  await store('installed')
  return true
}

export async function getList() {
  const out = await store('installed')
  return out.split('\n').filter((line) => line.startsWith('app\t')).map((line) => {
    const [, name, , version, , source, isProtected] = line.split('\t')
    return {
      name,
      version,
      source,
      protected: isProtected == '1',
      manifest_url: `http://${name}.localhost/manifest.webmanifest`,
    }
  })
}

export async function install(path) {
  const staged = await store('stage-file', path)
  const line = staged.split('\n').find((l) => l.startsWith('origin\t'))
  if (!line) {
    throw new Error("Can't tell which app this zip is: its manifest has no origin and more than one name")
  }
  return store('install', line.slice('origin\t'.length), 'sdcard')
}

export async function installFromStore(url, id, onStep) {
  onStep('Downloading...')
  await store('stage', url)
  onStep('Installing...')
  return store('install', id, url)
}

export async function installPWA(manifestUrl) {
  return store('install-pwa', manifestUrl)
}

export async function uninstall(manifestUrl) {
  return store('uninstall', new URL(manifestUrl).hostname.replace(/\.localhost$/, ''))
}

export async function getAppFile(origin, path) {
  const host = String(origin).replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return new Uint8Array(await get('http://' + host + path, 'arraybuffer'))
}

export async function getAppManifest(manifestUrl) {
  return get(manifestUrl, 'json')
}
