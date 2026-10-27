import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callUrlMethod } from '../src/api/appsmanager.js'

const manifestUrl = 'https://next-caltrain-pwa.appspot.com/manifest.webmanifest'

test('PWA install retries only the proven string-to-URL mismatch', async () => {
  const values = []
  const manager = {
    installPwa(value) {
      values.push(value)
      if (typeof value === 'string') throw new Error('Expected URL, got string')
      return 'installed'
    },
  }
  assert.equal(await callUrlMethod(manager, 'installPwa', manifestUrl), 'installed')
  assert.equal(typeof values[0], 'string')
  assert.ok(values[1] instanceof URL)
})

test('PWA install does not retry a service failure', async () => {
  let calls = 0
  const manager = {
    installPwa() {
      calls += 1
      throw new Error('MissingPermission')
    },
  }
  await assert.rejects(callUrlMethod(manager, 'installPwa', manifestUrl), /MissingPermission/)
  assert.equal(calls, 1)
})
