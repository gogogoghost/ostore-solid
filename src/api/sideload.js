// Sideload backend.
//
// Talks to the Sideload remote service of api-daemon instead of the legacy
// appscmd HTTP daemon. Sideload is only present on systems carrying the Sideload
// patch, and the service is only handed to applications granted the `sideload`
// permission; every entry point throws (with `kaiExtUnavailable = true`) when
// the service cannot be reached so the facade in ./index.js falls back to HTTP.

const SHARED_SCRIPTS = [
  'http://127.0.0.1/api/v1/shared/core.js',
  'http://127.0.0.1/api/v1/shared/session.js',
]
const SERVICE_SCRIPT = 'http://127.0.0.1/api/v1/sideload/service.js'

let connectPromise = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('failed to load ' + src))
    document.head.appendChild(script)
  })
}

function describe(error) {
  if (!error) return 'unknown error'
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.reason) return error.reason + ' ' + (error.value !== undefined ? JSON.stringify(error.value) : '')
  try {
    return JSON.stringify(error)
  } catch (e) {
    return String(error)
  }
}

// Errors that mean "Sideload is not usable here", as opposed to service level
// failures (a failed install must not be retried over HTTP).
function isUnavailable(error) {
  const text = describe(error)
  return /MissingPermission|UnknownService|FingerprintMismatch|session_closed|session (timeout|error|closed)|externalapi|failed to load|lib_(session|sideload) missing/i.test(text)
}

function unavailableError(error) {
  const wrapped = new Error('Sideload unavailable: ' + describe(error))
  wrapped.kaiExtUnavailable = true
  return wrapped
}

async function connect(timeoutMs = 5000) {
  if (typeof navigator.b2g?.externalapi?.getToken !== 'function') {
    throw new Error('externalapi is not available')
  }

  for (const src of SHARED_SCRIPTS) await loadScript(src)
  if (typeof lib_session === 'undefined' || typeof lib_session.Session === 'undefined') {
    throw new Error('lib_session missing')
  }

  const token = await navigator.b2g.externalapi.getToken()
  const session = new lib_session.Session()

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('session timeout')), timeoutMs)
    const settle = (fn) => (arg) => {
      clearTimeout(timer)
      fn(arg)
    }
    session.open('websocket', '127.0.0.1', token, {
      onsessionconnected: settle(() => resolve()),
      onsessiondisconnected: settle(() => reject(new Error('session closed'))),
      onsessionconnectionerror: settle(() => reject(new Error('session error'))),
    }, true)
  })

  await loadScript(SERVICE_SCRIPT)
  if (typeof lib_sideload === 'undefined' || !lib_sideload.Sideload) {
    throw new Error('lib_sideload missing')
  }

  // Rejects with MissingPermission / UnknownService when the application may
  // not use the service.
  return lib_sideload.Sideload.get(session)
}

function api() {
  if (!connectPromise) {
    connectPromise = connect().catch((error) => {
      connectPromise = null
      throw error
    })
  }
  return connectPromise
}

async function call(operation) {
  try {
    return await operation(await api())
  } catch (error) {
    if (isUnavailable(error)) {
      connectPromise = null
      throw unavailableError(error)
    }
    throw error
  }
}

/// Detection entry point used by the facade.
export async function probe() {
  await api()
  return true
}

export async function getList() {
  return call((service) => service.list())
}

export async function install(packagePath) {
  return call((service) => service.install(packagePath))
}

export async function installPWA(manifestUrl) {
  return call((service) => service.installPwa(manifestUrl))
}

export async function uninstall(manifestUrl) {
  return call((service) => service.uninstall(manifestUrl))
}

export async function getAppFile(origin, path) {
  return call((service) => service.getAppFile(origin, path))
}

export async function getAppManifest(origin) {
  return call((service) => service.getAppManifest(origin))
}
