const originFetch = window.fetch

window.fetch = function () {
    const args = [...arguments]
    const patch = { mode: 'no-cors' }
    if (args[1]) {
        Object.assign(args[1], patch)
    } else {
        args.push(patch)
    }
    return originFetch(...args)
}

export const baseUrl = import.meta.env.VITE_APPSCMD_BASEURL

export const resourceUrl = import.meta.env.VITE_SERVER_DL

export async function getList() {
    const res = await (await fetch(baseUrl + "list")).json()
    if (res.code != 0) {
        throw new Error(res.msg)
    }
    return res.data
}

export async function getAllList() {
    return await (await fetch(resourceUrl + "all.json")).json()
}

export async function getPopularList() {
    return await (await fetch(resourceUrl + "popular.json")).json()
}

export const proxyBaseUrl = baseUrl + "proxy/"

export async function install(path) {
    const res = await (await fetch(baseUrl + "install", {
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
    const res = await (await fetch(baseUrl + "install-pwa", {
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
    const res = await (await fetch(baseUrl + "uninstall", {
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
    const res = await fetch(proxyUrl(origin, path))
    if (!res.ok) {
        throw new Error("HTTP " + res.status)
    }
    return new Uint8Array(await res.arrayBuffer())
}

export async function getAppManifest(origin) {
    for (const name of ['manifest.webmanifest', 'manifest.webapp']) {
        try {
            const res = await fetch(proxyUrl(origin, '/' + name))
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