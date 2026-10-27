// OStore is the only catalogue. Its worker publishes raw ZIPs plus a stable
// `_update.webmanifest` pointer for each app; the signed variant of that
// pointer is what AppsManager installs, so no third-party catalogue or local
// ZIP download is needed for a store install.
import { systemFetch } from '../libs/systemFetch.js'

export const OSTORE_BASE = 'https://dl-ostore.yexm.eu.org/'

const OSTORE_ORIGIN = new URL(OSTORE_BASE).origin
const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const updatePointer = /^[A-Za-z0-9][A-Za-z0-9._-]*_update\.webmanifest$/

// The worker derives the signed pointer by inserting `_JscalatedSigned`
// before `.webmanifest`; its `package_path` is the signed ZIP.
export function signedUpdateUrl(updateUrl) {
  const url = new URL(String(updateUrl))
  if (url.protocol !== 'https:' || url.origin !== OSTORE_ORIGIN ||
      url.username || url.password || url.search || url.hash ||
      !updatePointer.test(url.pathname.slice(1))) {
    throw new Error('Invalid OStore update URL')
  }
  return `${url.origin}${url.pathname.replace(/\.webmanifest$/, '_JscalatedSigned.webmanifest')}`
}

async function readJson(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await systemFetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.type === 'opaque') {
      throw new Error(`OStore request was blocked at ${url}`)
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} at ${url}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function toApp(entry) {
  if (entry?.type !== 'app' ||
      typeof entry.id !== 'string' || !safeName.test(entry.id) ||
      typeof entry.name !== 'string' || !entry.name ||
      typeof entry.version !== 'string' || !safeName.test(entry.version)) {
    return null
  }
  let updateUrl
  let signedUrl
  try {
    updateUrl = new URL(entry.updateUrl)
    signedUrl = signedUpdateUrl(updateUrl.href)
  } catch (_) {
    return null
  }
  const icon = typeof entry.icon === 'string' && safeName.test(entry.icon)
    ? entry.icon
    : 'kaios_56.png'
  const fileName = `${entry.id}_${entry.version}.zip`
  return {
    id: entry.id,
    name: entry.name,
    desc: String(entry.desc || ''),
    version: entry.version,
    iconSrc: new URL(icon, OSTORE_BASE).href,
    source: 'ostore',
    updateUrl: updateUrl.href,
    signedUpdateUrl: signedUrl,
    fileName,
    url: new URL(fileName, OSTORE_BASE).href,
  }
}

async function loadCatalog(all) {
  const file = all ? 'all.json' : 'popular.json'
  const rows = await readJson(new URL(file, OSTORE_BASE).href)
  if (!Array.isArray(rows) || rows.length > 500) {
    throw new Error(`Invalid OStore ${file}`)
  }
  const seen = new Set()
  const apps = []
  for (const row of rows) {
    const app = toApp(row)
    if (!app || seen.has(app.id)) continue
    seen.add(app.id)
    apps.push(app)
  }
  return apps
}

export function getAllList() { return loadCatalog(true) }
export function getPopularList() { return loadCatalog(false) }
