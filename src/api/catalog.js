// The two built-in catalogues have different package formats. JScalated
// publishes AppsManager update manifests; OStore publishes ZIPs for its
// existing local sideload/appscmd path.
export const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({ id: 'jscalated', catalog: 'https://Garbagebuild.github.io/JScalated-Store/webapps.json' }),
  Object.freeze({ id: 'ostore', catalog: 'https://dl-ostore.yexm.eu.org/' }),
])

const JSCALATED_BASE = 'https://Garbagebuild.github.io/JScalated-Store/'
const OSTORE_BASE = 'https://dl-ostore.yexm.eu.org/'
const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

// A developer may host a stable update manifest for a newly listed app. The
// installed app keeps this URL, so later releases do not need a Store rebuild.
function stableHttpsUrl(value) {
  if (typeof value !== 'string' || !value || /[\\\s]/.test(value)) {
    throw new Error('Invalid app URL')
  }
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('App URL must be a stable HTTPS URL')
  }
  return url.href
}

export function resolveUpdateUrl(entry, appBase) {
  const fallback = `${appBase}update.webmanifest`
  return entry.update_url === undefined ? fallback : stableHttpsUrl(entry.update_url)
}

function xhrRead(url, kind) {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest !== 'function') {
      reject(new Error('SystemXHR is unavailable for the OStore source'))
      return
    }
    // OStore's download host currently omits CORS response headers. Only its
    // requests use mozSystem; GitHub Pages uses ordinary CORS-enabled fetch.
    const request = new XMLHttpRequest({ mozSystem: true })
    request.open('GET', url, true)
    request.timeout = 15000
    request.responseType = kind === 'blob' ? 'blob' : 'text'
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`OStore HTTP ${request.status} at ${url}`))
        return
      }
      try {
        resolve(kind === 'blob' ? request.response : JSON.parse(request.responseText))
      } catch (error) {
        reject(error)
      }
    }
    request.onerror = () => reject(new Error(`OStore request failed: ${url}`))
    request.ontimeout = () => reject(new Error(`OStore request timed out: ${url}`))
    request.send()
  })
}

async function fetchRead(url, kind, signal) {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok || response.type === 'opaque') {
    throw new Error(`HTTP ${response.status} at ${url}`)
  }
  return kind === 'blob' ? response.blob() : response.json()
}

async function developerVersion(updateUrl, origin, fallback) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const update = await fetchRead(updateUrl, 'json', controller.signal)
    if (update?.b2g_features?.origin !== origin) {
      throw new Error('Developer update origin differs from the listed app')
    }
    if (typeof update.version !== 'string' || !safeName.test(update.version)) {
      throw new Error('Invalid developer update version')
    }
    return update.version
  } catch (error) {
    console.warn('[ostore] developer update manifest unavailable:', updateUrl, error)
    return fallback
  } finally {
    clearTimeout(timer)
  }
}

async function readOStore(url, kind) {
  try {
    return await fetchRead(url, kind)
  } catch (fetchError) {
    try {
      return await xhrRead(url, kind)
    } catch (xhrError) {
      throw new Error(`OStore source unavailable: ${xhrError.message || fetchError.message}`)
    }
  }
}

function validCatalogUrl(url, base) {
  return url instanceof URL && url.href.startsWith(base) &&
    url.protocol === 'https:' && !url.username && !url.password
}

async function loadJScalated() {
  const catalog = await fetchRead(DEFAULT_SOURCES[0].catalog, 'json')
  if (catalog?.schema !== 1 || !Array.isArray(catalog.apps) || catalog.apps.length > 200) {
    throw new Error('Unsupported JScalated webapps.json')
  }
  // OStore replaces the older JScalated Store app, while its GitHub feed
  // remains a source for the other hosted packages.
  const entries = catalog.apps.filter(entry => entry?.folder !== 'JScalated-Store')
  const results = await Promise.allSettled(entries.map(async (entry) => {
    if (typeof entry?.folder !== 'string' || !safeName.test(entry.folder) ||
        typeof entry.name !== 'string' || typeof entry.version !== 'string') {
      throw new Error('Invalid JScalated catalogue entry')
    }
    const folder = encodeURIComponent(entry.folder)
    const appBase = `${JSCALATED_BASE}Apps-directory/${folder}/`
    if (entry.type === 'pwa') {
      const pwaManifestUrl = stableHttpsUrl(entry.manifest_url)
      const pwaManifest = await fetchRead(pwaManifestUrl, 'json')
      const id = pwaManifest?.id
      if (typeof id !== 'string' || !safeName.test(id)) {
        throw new Error('Invalid hosted app ID')
      }
      if (id.toLowerCase() !== String(entry.id || '').toLowerCase()) {
        throw new Error('Hosted app ID differs from the approved catalogue entry')
      }
      const liveVersion = pwaManifest?.b2g_features?.version
      return {
        id: id.toLowerCase(),
        name: entry.name,
        desc: String(entry.description || pwaManifest?.description || ''),
        version: typeof liveVersion === 'string' && safeName.test(liveVersion)
          ? liveVersion : entry.version,
        iconSrc: `${appBase}icon-56.png`,
        source: 'jscalated',
        installKind: 'pwa',
        pwaManifestUrl,
      }
    }
    if (entry.type !== undefined && entry.type !== 'packaged') {
      throw new Error('Unsupported JScalated app type')
    }
    const manifestUrl = `${appBase}manifest.webmanifest`
    let manifest = {}
    try { manifest = await fetchRead(manifestUrl, 'json') }
    catch (error) { console.warn('[ostore] JScalated app manifest unavailable:', manifestUrl, error) }
    const iconPath = manifest.icons?.[0]?.src
    const iconSrc = typeof iconPath === 'string' && iconPath
      ? new URL(iconPath.replace(/^\/+/, ''), appBase).href
      : '/kaios_56.png'
    const origin = String(manifest.b2g_features?.origin || '')
    const updateUrl = resolveUpdateUrl(entry, appBase)
    return {
      id: String(manifest.id || manifest.b2g_features?.origin || entry.folder).toLowerCase(),
      name: entry.name,
      desc: String(entry.description || ''),
      version: entry.update_url
        ? await developerVersion(updateUrl, origin, entry.version)
        : entry.version,
      iconSrc,
      source: 'jscalated',
      origin,
      updateUrl,
    }
  }))
  return results.filter(result => result.status === 'fulfilled').map(result => result.value)
}

async function loadOStore(all) {
  const file = all ? 'all.json' : 'popular.json'
  const rows = await readOStore(OSTORE_BASE + file, 'json')
  if (!Array.isArray(rows) || rows.length > 500) {
    throw new Error(`Invalid OStore ${file}`)
  }
  return rows.filter(entry =>
    typeof entry?.id === 'string' && safeName.test(entry.id) &&
    typeof entry.version === 'string' && safeName.test(entry.version) &&
    typeof entry.name === 'string'
  ).map(entry => {
    const fileName = `${entry.id}_${entry.version}.zip`
    const icon = typeof entry.icon === 'string' && safeName.test(entry.icon)
      ? entry.icon : 'kaios_56.png'
    return {
      id: entry.id,
      name: entry.name,
      desc: String(entry.desc || ''),
      version: entry.version,
      iconSrc: new URL(icon, OSTORE_BASE).href,
      fileName,
      url: new URL(fileName, OSTORE_BASE).href,
      source: 'ostore',
    }
  })
}

async function loadCatalogues(all) {
  const results = await Promise.allSettled([loadJScalated(), loadOStore(all)])
  const failed = results.filter(result => result.status === 'rejected')
  for (const result of failed) console.warn('[ostore] catalogue failed:', result.reason)
  if (failed.length === results.length) {
    throw new Error('JScalated GitHub and OStore catalogues are both unavailable')
  }
  const seen = new Set()
  const combined = []
  // Prefer JScalated's AppsManager-compatible entry when both list one ID.
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const app of result.value) {
      if (seen.has(app.id)) continue
      seen.add(app.id)
      combined.push(app)
    }
  }
  return combined
}

export function getAllList() { return loadCatalogues(true) }
export function getPopularList() { return loadCatalogues(false) }

export async function downloadOStorePackage(item) {
  if (item?.source !== 'ostore' || typeof item.url !== 'string' ||
      !validCatalogUrl(new URL(item.url), OSTORE_BASE)) {
    throw new Error('Invalid OStore package URL')
  }
  return readOStore(item.url, 'blob')
}
