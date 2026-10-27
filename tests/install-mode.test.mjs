import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MODE_IDS, chooseMode, loadModeState, normalizeAvailable,
  runWithFallback, saveModeState, STORAGE_AVAILABLE, STORAGE_MODE,
} from '../src/api/modes.js'

function fakeStorage() {
  const values = new Map()
  return {
    values,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('available modes are canonical, deduplicated, and unknown values dropped', () => {
  assert.deepEqual(MODE_IDS, ['appsmanager', 'sideload', 'flipfull', 'appscmd'])
  assert.deepEqual(normalizeAvailable(['appscmd', 'sideload', 'appscmd', 'bogus']),
    ['sideload', 'appscmd'])
  assert.deepEqual(normalizeAvailable('sideload'), [])
})

test('mode selection keeps a detected preference and otherwise takes the first', () => {
  assert.equal(chooseMode(['sideload', 'appscmd'], 'appscmd'), 'appscmd')
  assert.equal(chooseMode(['sideload', 'appscmd'], 'appsmanager'), 'sideload')
  assert.equal(chooseMode([], 'sideload'), 'appscmd')
})

test('mode state persists across launches and ignores corrupt data', () => {
  const original = globalThis.localStorage
  const store = fakeStorage()
  globalThis.localStorage = store
  try {
    saveModeState('flipfull', ['appscmd', 'flipfull', 'bogus'])
    assert.deepEqual(loadModeState(), { mode: 'flipfull', available: ['flipfull', 'appscmd'] })

    saveModeState('sideload', [])
    assert.deepEqual(loadModeState(), { mode: 'sideload', available: ['sideload'] })

    store.setItem(STORAGE_MODE, 'bogus')
    store.setItem(STORAGE_AVAILABLE, '{not json')
    assert.deepEqual(loadModeState(), { mode: null, available: [] })
  } finally {
    if (original === undefined) delete globalThis.localStorage
    else globalThis.localStorage = original
  }
})

test('fallback tries the next mode only for unavailable failures', async () => {
  const calls = []
  const dropped = []
  const result = await runWithFallback(
    ['appsmanager', 'appsmanager', 'sideload', 'appscmd'],
    async mode => {
      calls.push(mode)
      if (mode === 'appsmanager') {
        const error = new Error('MissingPermission')
        error.unavailable = true
        throw error
      }
      return mode
    },
    error => error.unavailable === true,
    mode => dropped.push(mode),
  )
  assert.equal(result, 'sideload')
  assert.deepEqual(calls, ['appsmanager', 'sideload'])
  assert.deepEqual(dropped, ['appsmanager'])
})

test('a real install error is not retried on another mode', async () => {
  let calls = 0
  await assert.rejects(runWithFallback(
    ['sideload', 'flipfull'],
    async () => {
      calls += 1
      throw new Error('invalid zip')
    },
    () => false,
  ), /invalid zip/)
  assert.equal(calls, 1)
  await assert.rejects(runWithFallback([], async () => 'ok', () => true),
    /No install backend is available/)
})
