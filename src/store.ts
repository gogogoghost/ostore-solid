import { createSignal } from 'solid-js'
import { getList, getAppFile, getAppManifest } from './api'

const [installedAppList, setInstalledAppList] = createSignal([])

// Blob URLs created for the icons of the current list, revoked on refresh.
let iconUrls = []

// Last failure already reported to the user, so a refresh does not stack
// alerts for the same problem.
let reportedError = ''

async function updateInstalledAppList() {
    try {
        const res = await getList()

        for (const url of iconUrls) {
            URL.revokeObjectURL(url)
        }
        iconUrls = []

        for (const item of res) {
            item.iconSrc = '/kaios_56.png' // OStore's own fallback asset
            item.manifestObj = {} // so views can render even when the manifest is missing

            // Vhost address of the application: packaged apps are served from
            // `<name>.localhost/`, cached PWAs from `cached.localhost/<name>/`.
            // The apps service reports the manifest URL, which carries both the
            // host and the base path (the origin of a PWA is its remote URL and
            // cannot be used here).
            let location
            try {
                const url = new URL(item.manifest_url)
                location = { host: url.host, base: url.pathname.replace(/\/[^/]*$/, '/') }
            } catch (e) {
                continue
            }

            try {
                const manifest = await getAppManifest(item.manifest_url)
                item.manifestObj = manifest
                item.version = (manifest.b2g_features && manifest.b2g_features.version) || ''

                const iconPath = manifest.icons && manifest.icons[0] && manifest.icons[0].src
                if (!iconPath) {
                    continue // keep the fallback icon
                }

                const resolved = iconPath.startsWith('http')
                    ? new URL(iconPath).pathname
                    : location.base + String(iconPath).replace(/^\//, '')

                const mime = /\.svg$/i.test(resolved) ? 'image/svg+xml'
                    : /\.jpe?g$/i.test(resolved) ? 'image/jpeg'
                        : /\.webp$/i.test(resolved) ? 'image/webp'
                            : 'image/png'

                const bytes = await getAppFile(location.host, resolved)
                const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
                iconUrls.push(url)
                item.iconSrc = url
            } catch (e) {
                console.error('failed to load manifest/icon of ' + item.name, e)
            }
        }

        setInstalledAppList(res)
        reportedError = ''
    } catch (e) {
        console.error(e)
        const message = (e && (e.message || String(e))) || 'unknown error'
        if (message !== reportedError) {
            reportedError = message
            alert('Failed to load the application list: ' + message)
        }
    }
}

export {
    installedAppList, updateInstalledAppList
}
