export const baseUrl = import.meta.env.VITE_APPSCMD_BASEURL

export const resourceUrl = import.meta.env.VITE_SERVER_DL

// Only the legacy local appscmd API needs system-level cross-origin access.
// Keep this scoped here so public catalogue fetches retain readable responses.
function request(path, options = {}) {
    const url = new URL(path, baseUrl).href
    if (typeof XMLHttpRequest !== 'function' || typeof navigator === 'undefined' || !navigator.b2g) {
        return fetch(url, options)
    }
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest({ mozSystem: true })
        xhr.open(options.method || 'GET', url, true)
        xhr.responseType = 'arraybuffer'
        xhr.timeout = 15000
        for (const [name, value] of Object.entries(options.headers || {})) {
            xhr.setRequestHeader(name, value)
        }
        xhr.onload = () => resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            json: async () => JSON.parse(new TextDecoder().decode(xhr.response)),
            arrayBuffer: async () => xhr.response,
        })
        xhr.onerror = () => reject(new Error('appscmd request failed: ' + path))
        xhr.ontimeout = () => reject(new Error('appscmd request timed out: ' + path))
        xhr.send(options.body || null)
    })
}

export async function getList() {
    const res = await (await request("list")).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

export const proxyBaseUrl = baseUrl + "proxy/"

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

function proxyUrl(origin, path) {
    const host = String(origin).replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const suffix = path.startsWith('/') ? path : '/' + path
    return proxyBaseUrl + host + suffix
}

export async function getAppFile(origin, path) {
    const res = await request(proxyUrl(origin, path))
    if (!res.ok) {
        throw new Error("HTTP " + res.status)
    }
    return new Uint8Array(await res.arrayBuffer())
}

export async function getAppManifest(origin) {
    for (const name of ['manifest.webmanifest', 'manifest.webapp']) {
        try {
            const res = await request(proxyUrl(origin, '/' + name))
            if (!res.ok) {
                continue
            }
            return await res.json()
        } catch (e) {
            // try the next manifest name
        }
    }
    throw new Error("unable to read manifest of " + origin)
}
