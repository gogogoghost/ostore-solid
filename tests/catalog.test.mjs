import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAllList, getPopularList, signedUpdateUrl, OSTORE_BASE } from '../src/api/catalog.js'

const rows = [
  {
    id: 'airshou', name: 'AirShou', desc: 'Screen recorder', icon: 'airshou_56.png',
    type: 'app', version: '1.0.0',
    updateUrl: `${OSTORE_BASE}airshou_update.webmanifest`, history: [],
  },
  {
    id: 'ostore', name: 'OStore', desc: 'Store', icon: 'ostore_56.png',
    type: 'app', version: '1.2.2',
    updateUrl: `${OSTORE_BASE}ostore_update.webmanifest`, history: ['1.2.1'],
  },
]

function respond(body, type = 'basic') {
  return { ok: true, type, status: 200, json: async () => body }
}

test('signed pointer inserts _JscalatedSigned before the extension', () => {
  assert.equal(
    signedUpdateUrl(`${OSTORE_BASE}ostore_update.webmanifest`),
    `${OSTORE_BASE}ostore_update_JscalatedSigned.webmanifest`,
  )
})

test('signed pointer rejects foreign, insecure, and unstable URLs', () => {
  for (const url of [
    'http://dl-ostore.yexm.eu.org/ostore_update.webmanifest',
    'https://example.com/ostore_update.webmanifest',
    'https://user:pass@dl-ostore.yexm.eu.org/ostore_update.webmanifest',
    'https://dl-ostore.yexm.eu.org/ostore_update.webmanifest?v=1',
    'https://dl-ostore.yexm.eu.org/ostore_update.webmanifest#v1',
    'https://dl-ostore.yexm.eu.org/ostore_1.2.2.zip',
  ]) {
    assert.throws(() => signedUpdateUrl(url), /Invalid OStore update URL/)
  }
})

test('catalogue uses KaiOS privileged no-cors fetch', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    return respond(rows)
  }
  try {
    const apps = await getAllList()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], `${OSTORE_BASE}all.json`)
    assert.equal(calls[0][1].mode, 'no-cors')
    assert.equal(calls[0][1].cache, 'no-store')
    assert.ok(calls[0][1].signal)
    assert.deepEqual(apps.map(app => app.id), ['airshou', 'ostore'])
    assert.equal(apps[0].iconSrc, `${OSTORE_BASE}airshou_56.png`)
    assert.equal(apps[0].signedUpdateUrl,
      `${OSTORE_BASE}airshou_update_JscalatedSigned.webmanifest`)
    assert.equal(apps[0].source, 'ostore')
    assert.equal(apps[0].fileName, 'airshou_1.0.0.zip')
    assert.equal(apps[0].url, `${OSTORE_BASE}airshou_1.0.0.zip`)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('popular catalogue reads popular.json and deduplicates ids', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    return respond([...rows, rows[0]])
  }
  try {
    const apps = await getPopularList()
    assert.deepEqual(calls, [`${OSTORE_BASE}popular.json`])
    assert.deepEqual(apps.map(app => app.id), ['airshou', 'ostore'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('catalogue skips entries that cannot be installed from a signed pointer', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => respond([
    rows[0],
    { ...rows[0], id: '../escape' },
    { ...rows[0], id: 'pwa', type: 'pwa' },
    { ...rows[0], id: 'foreign', updateUrl: 'https://example.com/foreign_update.webmanifest' },
    { ...rows[0], id: 'missing' , updateUrl: undefined },
    { ...rows[0], id: 'badversion', version: '1.0 beta' },
  ])
  try {
    assert.deepEqual((await getAllList()).map(app => app.id), ['airshou'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('catalogue rejects opaque responses and non-array payloads', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => respond(rows, 'opaque')
    await assert.rejects(getAllList(), /blocked/)

    globalThis.fetch = async () => respond({ apps: rows })
    await assert.rejects(getAllList(), /Invalid OStore all\.json/)

    globalThis.fetch = async () => respond(Array.from({ length: 501 }, () => rows[0]))
    await assert.rejects(getAllList(), /Invalid OStore all\.json/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
