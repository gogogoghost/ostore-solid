import { createSignal } from 'solid-js'
import { getList, getAppFile, getAppManifest } from './api'

const [installedAppList, setInstalledAppList] = createSignal([])

// Blob URLs created for the icons of the current list, revoked on refresh.
let iconUrls = []

function iconMime(path) {
    if (/\.svg$/i.test(path)) return 'image/svg+xml'
    if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
    if (/\.webp$/i.test(path)) return 'image/webp'
    return 'image/png'
}

async function updateInstalledAppList() {
    try {
        const res = await getList()

        for (const url of iconUrls) {
            URL.revokeObjectURL(url)
        }
        iconUrls = []

        for (const item of res) {
            item.iconSrc = '/kaios_56.png'
            try {
                const manifest = await getAppManifest(item.origin)
                item.manifestObj = manifest
                item.version = (manifest.b2g_features && manifest.b2g_features.version) || ''

                let iconSrc = (manifest.icons && manifest.icons[0] && manifest.icons[0].src) || '/kaios_56.png'
                if (iconSrc.startsWith('http')) {
                    // Remote icon: the backend fetches it through the vhost.
                    iconSrc = new URL(iconSrc).pathname
                }
                if (!iconSrc.startsWith('/')) {
                    iconSrc = '/' + iconSrc
                }

                const bytes = await getAppFile(item.origin, iconSrc)
                const url = URL.createObjectURL(new Blob([bytes], { type: iconMime(iconSrc) }))
                iconUrls.push(url)
                item.iconSrc = url
            } catch (e) {
                console.error('failed to load manifest/icon of ' + item.name, e)
            }
        }

        setInstalledAppList(res)
    } catch (e) {
        console.error(e)
    }
}

export {
    installedAppList, updateInstalledAppList
}
