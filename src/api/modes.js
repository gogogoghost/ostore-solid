// Install backends. AppsManager installs the signed store package; the other
// modes install the unsigned ZIP through their local service.
export const MODES = Object.freeze([
  Object.freeze({ id: 'appsmanager', label: 'AppsManager' }),
  Object.freeze({ id: 'sideload', label: 'Sideload' }),
  Object.freeze({ id: 'flipfull', label: 'Flipfull' }),
  Object.freeze({ id: 'appscmd', label: 'appscmd' }),
])

export const MODE_IDS = Object.freeze(MODES.map(mode => mode.id))
export const LOCAL_MODE_IDS = Object.freeze(['sideload', 'flipfull', 'appscmd'])
export const STORAGE_MODE = 'ostore.install-mode'
export const STORAGE_AVAILABLE = 'ostore.available-modes'

function storage() {
  try { return globalThis.localStorage || null } catch (_) { return null }
}

function read(key) {
  try { return storage()?.getItem(key) ?? null } catch (_) { return null }
}

function write(key, value) {
  try { storage()?.setItem(key, value) } catch (_) { /* Storage may be disabled. */ }
}

// Keep only known modes, in the canonical preference order, without duplicates.
export function normalizeAvailable(value) {
  if (!Array.isArray(value)) return []
  return MODE_IDS.filter(id => value.includes(id))
}

export function loadModeState() {
  const stored = read(STORAGE_MODE)
  const mode = MODE_IDS.includes(stored) ? stored : null
  let available = []
  const raw = read(STORAGE_AVAILABLE)
  if (raw) {
    try { available = normalizeAvailable(JSON.parse(raw)) } catch (_) { /* Keep none. */ }
  }
  if (!available.length && mode) available = [mode]
  return { mode, available }
}

export function saveModeState(mode, available) {
  write(STORAGE_MODE, mode)
  write(STORAGE_AVAILABLE, JSON.stringify(normalizeAvailable(available)))
}

// Preference order: keep the user's mode when it was detected, otherwise the
// first detected mode. The last mode is only a retry target when nothing was.
export function chooseMode(available, preferred) {
  const modes = normalizeAvailable(available)
  if (preferred && modes.includes(preferred)) return preferred
  return modes[0] || MODE_IDS[MODE_IDS.length - 1]
}

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index)
}

// Try each mode until one succeeds. `isUnavailable` decides whether a failure
// means "this backend is not usable here" or a real operation error that must
// be reported without retrying another backend.
export async function runWithFallback(order, attempt, isUnavailable, onUnavailable) {
  let lastError = null
  for (const mode of unique(order)) {
    try {
      return await attempt(mode)
    } catch (error) {
      lastError = error
      if (!isUnavailable || !isUnavailable(error)) throw error
      onUnavailable?.(mode, error)
    }
  }
  throw lastError || new Error('No install backend is available')
}
