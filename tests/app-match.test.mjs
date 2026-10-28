import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    bestCatalogueMatch, catalogueAction, installedAliases, matchesCatalogueItem,
} from '../src/libs/appMatch.js'

const signedUpdateUrl = 'https://dl-ostore.yexm.eu.org/example_update_JscalatedSigned.webmanifest'

test('installed apps expose their name, origin host, and cached PWA name', () => {
    assert.deepEqual([...installedAliases({
        name: 'ostore',
        origin: 'http://ostore.localhost',
        manifest_url: 'http://ostore.localhost/manifest.webmanifest',
    })].sort(), ['ostore'])

    assert.deepEqual([...installedAliases({
        name: 'maps',
        source: 'https://www.google.com',
        manifest_url: 'http://cached.localhost/maps/manifest.webmanifest',
    })].sort(), ['maps'])

    assert.deepEqual([...installedAliases({ name: 'Sideloaded' })], ['sideloaded'])
})

test('catalogue entries match installed apps regardless of case or origin shape', () => {
    const item = { id: 'ostore', name: 'OStore', signedUpdateUrl }
    assert.equal(matchesCatalogueItem(item, {
        name: 'ostore',
        origin: 'http://ostore.localhost',
    }), true)
    assert.equal(matchesCatalogueItem(item, { name: 'OStore' }), true)
    assert.equal(matchesCatalogueItem(item, { update_url: signedUpdateUrl }), true)
    assert.equal(matchesCatalogueItem(item, { name: 'other' }), false)
})

test('AppsManager upgrades signed records and migrates other sources', () => {
    const installed = {
        installedVersion: 'Installed',
        manifestUrl: 'http://example.localhost/manifest.webmanifest',
        installedUpdateUrl: signedUpdateUrl,
        signedUpdateUrl,
    }
    assert.equal(catalogueAction({ ...installed, versionState: 1 }, 'appsmanager'), 'Upgrade')
    assert.equal(catalogueAction({ ...installed, versionState: 0 }, 'appsmanager'), null)
    assert.equal(catalogueAction({ ...installed, versionState: -1 }, 'appsmanager'), null)
    assert.equal(catalogueAction({
        ...installed,
        versionState: 1,
        installedUpdateUrl: 'https://example.invalid/update.webmanifest',
    }, 'appsmanager'), 'Migrate')
    assert.equal(catalogueAction({
        ...installed,
        versionState: 1,
        installedUpdateUrl: '',
    }, 'appsmanager'), 'Migrate')
    assert.equal(catalogueAction({ ...installed, versionState: 1, signedUpdateUrl: null },
        'appsmanager'), null)
    assert.equal(catalogueAction({ ...installed, versionState: 1, manifestUrl: null },
        'appsmanager'), 'Migrate')
})

test('a signed record wins when several installed records match', () => {
    const item = { id: 'ostore', name: 'OStore', signedUpdateUrl }
    const oldCopy = { name: 'ostore', origin: 'http://ostore.localhost', update_url: '' }
    const signedCopy = {
        name: 'ostore1',
        origin: 'http://ostore1.localhost',
        update_url: signedUpdateUrl,
    }
    assert.equal(bestCatalogueMatch(item, [oldCopy, signedCopy]), signedCopy)
    assert.equal(bestCatalogueMatch(item, [oldCopy]), oldCopy)
    assert.equal(bestCatalogueMatch(item, []), undefined)
})

test('local modes keep reinstall and downgrade actions', () => {
    const installed = {
        installedVersion: '1.0.0',
        manifestUrl: 'http://example.localhost/manifest.webmanifest',
    }
    assert.equal(catalogueAction({ ...installed, versionState: 1 }, 'sideload'), 'Upgrade')
    assert.equal(catalogueAction({ ...installed, versionState: 0 }, 'sideload'), 'Reinstall')
    assert.equal(catalogueAction({ ...installed, versionState: -1 }, 'appscmd'), 'Downgrade')
    assert.equal(catalogueAction({ versionState: 0 }, 'flipfull'), 'Install')
})
