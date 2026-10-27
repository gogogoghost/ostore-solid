import { systemFetch } from '../libs/systemFetch.js'

export const baseUrl = import.meta.env.VITE_APPSCMD_BASEURL

// The legacy local appscmd backend. Catalogue requests go straight to the
// OStore host in catalog.js; this client only serves manual ZIP installs and
// the installed-app list on devices carrying the daemon.
async function request(path, options = {}) {
    const url = new URL(path, baseUrl).href
    try {
        const response = await systemFetch(url, options)
        if (response.type === 'opaque') {
            throw new Error('request was blocked')
        }
        return response
    } catch (error) {
        throw new Error(`appscmd request failed: ${path} (${(error && error.message) || error})`)
    }
}

export async function getList() {
    const res = await (await request("list")).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

export async function probe() {
    await getList()
    return true
}

const proxyBaseUrl = baseUrl + "proxy/"

export async function install(path) {
    const res = await (await request("install", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: path })
    })).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

export async function installPWA(path) {
    const res = await (await request("install-pwa", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: path })
    })).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

export async function uninstall(manifestUrl) {
    const res = await (await request("uninstall", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: manifestUrl })
    })).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

// --- installed app content (the HTTP proxy of the legacy appscmd daemon) ---

function proxyTarget(target, path = '') {
    const source = new URL(/^https?:\/\//.test(target) ? target : 'http://' + target)
    const suffix = path || source.pathname
    return proxyBaseUrl + source.host + (suffix.startsWith('/') ? suffix : '/' + suffix)
}

export async function getAppFile(origin, path) {
    const res = await request(proxyTarget(origin, path))
    if (!res.ok) {
        throw new Error("HTTP " + res.status)
    }
    return new Uint8Array(await res.arrayBuffer())
}

export async function getAppManifest(target) {
    // The caller may pass a bare host or the installed manifest URL.
    const urls = /^https?:\/\//.test(target)
        ? [proxyTarget(target)]
        : ['manifest.webmanifest', 'manifest.webapp'].map(name => proxyTarget(target, name))
    for (const url of urls) {
        try {
            const res = await request(url)
            if (!res.ok) {
                continue
            }
            return await res.json()
        } catch (e) {
            // try the next manifest name
        }
    }
    throw new Error("unable to read manifest of " + target)
}
