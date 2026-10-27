import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  callUrlMethod, checkOwnUpdateWithManager, errorText, findOwnApp, isUnavailable,
} from '../src/api/appsmanager.js'

const updateUrl = 'https://dl-ostore.yexm.eu.org/example_update_JscalatedSigned.webmanifest'

test('URL argument representation follows the local encoder', async () => {
  for (const expected of ['string', 'object']) {
    const calls = []
    const manager = {
      wrapper_payload_message: { InstallPackageRequest: { encode(payload) {
        if (typeof payload.updateUrl !== expected) throw new TypeError('wrong argument type')
      } } },
      installPackage(value) { calls.push(value); return Promise.resolve('ok') },
    }
    assert.equal(await callUrlMethod(manager, 'installPackage', updateUrl), 'ok')
    assert.equal(calls.length, 1)
    assert.equal(typeof calls[0], expected)
  }
})

test('a proven string/URL mismatch retries once, other failures do not', async () => {
  for (const [message, expectedTypes] of [
    ['Expected URL, got string', ['string', 'object']],
    ['Expected string, bug got object', ['string']],
  ]) {
    const calls = []
    const manager = { installPackage(value) {
      calls.push(typeof value)
      if (calls.length === 1) throw new TypeError(message)
      return 'ok'
    } }
    if (expectedTypes.length === 1) {
      await assert.rejects(callUrlMethod(manager, 'installPackage', updateUrl), TypeError)
    } else {
      assert.equal(await callUrlMethod(manager, 'installPackage', updateUrl), 'ok')
    }
    assert.deepEqual(calls, expectedTypes)
  }

  for (const message of ['INVALID_SIGNATURE', 'NETWORK_FAILURE', 'Timed out']) {
    let calls = 0
    const manager = { installPackage() { calls++; throw new Error(message) } }
    await assert.rejects(callUrlMethod(manager, 'installPackage', updateUrl), /./)
    assert.equal(calls, 1, `Do not repeat a service action after ${message}`)
  }
})

test('service errors are described with their AppsServiceError name', () => {
  const originalLibApps = globalThis.lib_apps
  try {
    globalThis.lib_apps = { AppsServiceError: { INVALID_SIGNATURE: 14 } }
    assert.equal(errorText({ value: 14 }), 'INVALID_SIGNATURE')
    assert.equal(errorText({ value: { error: 14 }, reason: 'package rejected' }),
      'INVALID_SIGNATURE: package rejected')
    assert.equal(errorText(14), 'INVALID_SIGNATURE')
    assert.equal(errorText(new Error('connection lost')), 'connection lost')
    assert.equal(errorText(undefined), 'AppsManager returned no error details')
  } finally {
    globalThis.lib_apps = originalLibApps
  }
})

test('the installed OStore record is found in both field spellings', () => {
  assert.equal(findOwnApp([
    { origin: 'other', manifestUrl: 'http://other.localhost/manifest.webmanifest' },
    { origin: 'ostore', manifestUrl: 'http://ostore.localhost/manifest.webmanifest' },
  ]).origin, 'ostore')
  assert.equal(findOwnApp([{ manifestURL: 'http://ostore.localhost/manifest.webmanifest' }])
    .manifestURL, 'http://ostore.localhost/manifest.webmanifest')
  assert.equal(findOwnApp([{ manifest_url: 'http://ostore.localhost/manifest.webmanifest' }])
    .manifest_url, 'http://ostore.localhost/manifest.webmanifest')
  assert.equal(findOwnApp([{ origin: 'other' }]), undefined)
})

test('self-update checks the recorded URL and only updates after confirmation', async () => {
  const calls = []
  const self = {
    origin: 'ostore',
    update_url: updateUrl,
    manifest_url: 'http://ostore.localhost/manifest.webmanifest',
  }
  const manager = {
    getAll: async () => [self],
    checkForUpdate: async (url, options) => {
      calls.push(['check', url, options])
      return true
    },
    update: async url => { calls.push(['update', url]); return self },
  }
  assert.equal(await checkOwnUpdateWithManager(manager, () => true), true)
  assert.deepEqual(calls, [
    ['check', updateUrl, { autoInstall: false }],
    ['update', self.manifest_url],
  ])
  calls.length = 0
  assert.equal(await checkOwnUpdateWithManager(manager, () => false), false)
  assert.equal(calls.length, 1, 'Declining self-update must not call update')
})

test('only service availability errors trigger mode fallback', () => {
  assert.equal(isUnavailable(new Error('MissingPermission')), true)
  assert.equal(isUnavailable(new Error('AppsManager connection timed out')), true)
  assert.equal(isUnavailable(new Error('Could not load http://127.0.0.1/api/v1/apps/service.js')), true)
  assert.equal(isUnavailable(new Error('INVALID_SIGNATURE')), false)
  assert.equal(isUnavailable(new Error('No update is available')), false)
})
