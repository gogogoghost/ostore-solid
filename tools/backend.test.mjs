import assert from 'node:assert/strict'
import { getAllList, getPopularList, DEFAULT_SOURCES } from '../src/api/catalog.js'
import { callUrlMethod, errorText } from '../src/api/appsmanager.js'

const pages = 'https://Garbagebuild.github.io/JScalated-Store/'
const ostore = 'https://dl-ostore.yexm.eu.org/'
const updateUrl = pages + 'Apps-directory/Example/update.webmanifest'

assert.deepEqual(DEFAULT_SOURCES.map(source => source.id), ['jscalated', 'ostore'])

const originalFetch = globalThis.fetch
const originalXHR = globalThis.XMLHttpRequest

function response(value) {
  return { ok: true, type: 'basic', json: async () => value }
}

try {
  globalThis.fetch = async url => {
    if (url === pages + 'webapps.json') {
      return response({ schema: 1, apps: [
        { folder: 'Example', name: 'Example', version: '2.0', description: 'Sample' },
      ] })
    }
    if (url === pages + 'Apps-directory/Example/manifest.webmanifest') {
      return response({ id: 'example', b2g_features: { origin: 'example' },
        icons: [{ src: '/icon.png' }] })
    }
    if (url === ostore + 'all.json' || url === ostore + 'popular.json') {
      return response([
        { id: 'other', name: 'Other', version: '1.0', icon: 'other.png' },
        { id: 'example', name: 'Duplicate', version: '1.0', icon: 'example.png' },
      ])
    }
    throw new Error('Unexpected URL ' + url)
  }
  const all = await getAllList()
  assert.deepEqual(all.map(app => [app.id, app.source]),
    [['example', 'jscalated'], ['other', 'ostore']])
  assert.equal(all[0].updateUrl, updateUrl)
  assert.equal(all[0].iconSrc, new URL('Apps-directory/Example/icon.png', pages).href)
  assert.equal(all[1].url, ostore + 'other_1.0.zip')
  assert.deepEqual((await getPopularList()).map(app => app.id), ['example', 'other'])

  // A missing OStore source must leave the GitHub catalogue usable.
  const workingFetch = globalThis.fetch
  globalThis.fetch = async url => {
    if (String(url).startsWith(ostore)) throw new Error('network unavailable')
    return workingFetch(url)
  }
  globalThis.XMLHttpRequest = undefined
  assert.deepEqual((await getAllList()).map(app => app.id), ['example'])

  // OStore can be read through its already requested SystemXHR permission.
  globalThis.XMLHttpRequest = class {
    open(_method, url) { this.url = url }
    send() {
      this.status = 200
      this.responseText = JSON.stringify([{ id: 'other', name: 'Other', version: '1.0' }])
      this.onload()
    }
  }
  assert.deepEqual((await getAllList()).map(app => app.id), ['example', 'other'])

  // A missing GitHub source must likewise leave OStore usable.
  globalThis.fetch = async url => {
    if (String(url).startsWith(pages)) throw new Error('GitHub unavailable')
    return response([{ id: 'other', name: 'Other', version: '1.0' }])
  }
  assert.deepEqual((await getAllList()).map(app => app.id), ['other'])
} finally {
  globalThis.fetch = originalFetch
  globalThis.XMLHttpRequest = originalXHR
}

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

{
  const calls = []
  const manager = {
    wrapper_payload_message: { InstallPackageRequest: { encode(payload) {
      if (!(payload.updateUrl instanceof URL)) throw new TypeError('Expected URL, got string')
    } } },
    installPackage(value) {
      calls.push(typeof value)
      if (typeof value !== 'string') throw new TypeError('Expected string, bug got object')
      return 'ok'
    },
  }
  assert.equal(await callUrlMethod(manager, 'installPackage', updateUrl), 'ok')
  assert.deepEqual(calls, ['object', 'string'])
}

for (const message of ['INVALID_SIGNATURE', 'NETWORK_FAILURE', 'Timed out']) {
  let calls = 0
  const manager = { installPackage() { calls++; throw new Error(message) } }
  await assert.rejects(callUrlMethod(manager, 'installPackage', updateUrl), /./)
  assert.equal(calls, 1, `Do not repeat a service action after ${message}`)
}

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

console.log('Catalog isolation and AppsManager argument handling passed')
