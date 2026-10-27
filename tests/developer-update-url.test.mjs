import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAllList, resolveUpdateUrl } from '../src/api/catalog.js'

const appBase = 'https://garbagebuild.github.io/JScalated-Store/Apps-directory/Example/'

test('existing catalogue entries retain their Store update URL', () => {
  assert.equal(resolveUpdateUrl({}, appBase), `${appBase}update.webmanifest`)
})

test('developer-owned update URL is used by the catalogue', async () => {
  const originalFetch = globalThis.fetch
  const updateUrl = 'https://example.github.io/updates/example/update.webmanifest'
  globalThis.fetch = async url => {
    if (url.endsWith('/webapps.json')) {
      return { ok: true, type: 'basic', json: async () => ({
        schema: 1,
        apps: [{ folder: 'Example', name: 'Example', version: '1.0', update_url: updateUrl }],
      }) }
    }
    if (url.endsWith('/Apps-directory/Example/manifest.webmanifest')) {
      return { ok: true, type: 'basic', json: async () => ({ id: 'example', b2g_features: { origin: 'example' } }) }
    }
    if (url === updateUrl) {
      return { ok: true, type: 'basic', json: async () => ({ version: '2.0', b2g_features: { origin: 'example' } }) }
    }
    return { ok: true, type: 'basic', json: async () => [] }
  }
  try {
    const apps = await getAllList()
    assert.equal(apps.length, 1)
    assert.equal(apps[0].updateUrl, updateUrl)
    assert.equal(apps[0].origin, 'example')
    assert.equal(apps[0].version, '2.0')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('rejects non-HTTPS and unstable update URLs', () => {
  for (const update_url of [
    'http://example.com/update.webmanifest',
    'javascript:alert(1)',
    'https://user:pass@example.com/update.webmanifest',
    'https://example.com/update.webmanifest?version=latest',
    'https://example.com/update.webmanifest#latest',
  ]) {
    assert.throws(() => resolveUpdateUrl({ update_url }, appBase))
  }
})

test('hosted PWA uses the owner manifest and the Store icon', async () => {
  const originalFetch = globalThis.fetch
  const manifestUrl = 'https://next-caltrain-pwa.appspot.com/manifest.webmanifest'
  globalThis.fetch = async url => {
    if (url.endsWith('/webapps.json')) {
      return { ok: true, type: 'basic', json: async () => ({ schema: 1, apps: [{
        folder: 'Next-Caltrain', id: 'nextcaltrain', name: 'Caltrain', version: '3.0.0', type: 'pwa',
        manifest_url: manifestUrl,
      }] }) }
    }
    if (url === manifestUrl) {
      return { ok: true, type: 'basic', json: async () => ({
        id: 'nextcaltrain', b2g_features: { version: '3.0.1' },
      }) }
    }
    return { ok: true, type: 'basic', json: async () => [] }
  }
  try {
    const apps = await getAllList()
    assert.equal(apps.length, 1)
    assert.equal(apps[0].id, 'nextcaltrain')
    assert.equal(apps[0].version, '3.0.1')
    assert.equal(apps[0].installKind, 'pwa')
    assert.equal(apps[0].pwaManifestUrl, manifestUrl)
    assert.equal(apps[0].iconSrc,
      'https://Garbagebuild.github.io/JScalated-Store/Apps-directory/Next-Caltrain/icon-56.png')
  } finally {
    globalThis.fetch = originalFetch
  }
})
