import { createSignal } from 'solid-js'
import { getList, proxyBaseUrl } from './api/api'

const [installedAppList, setInstalledAppList] = createSignal([]);

async function updateInstalledAppList() {
    try {
        const res = await getList()
        // get manifest
        for (const item of res) {
            item.baseUrl = proxyBaseUrl + item.origin.replace('http://', '')
            const obj = await (await fetch(proxyBaseUrl + item.manifest_url.replace('http://', ''))).json()
            item.manifestObj = obj
            // console.log(item)
            item.version = obj.b2g_features.version;
            try {
                let iconSrc = obj.icons[0].src
                if (iconSrc.startsWith('http')) {
                    item.iconSrc = proxyBaseUrl + iconSrc.replace('http://', '')
                } else {
                    if (!iconSrc.startsWith('/')) {
                        iconSrc = '/' + iconSrc;
                    }
                    item.iconSrc = item.baseUrl + iconSrc
                }
            } catch (e) {
                item.iconSrc = "/kaios_56.png"
            }
        }
        setInstalledAppList(res)
    } catch (e) {
        console.error(e)
        // alert(e.message || "Unkown Error")
    }
}

export {
    installedAppList, updateInstalledAppList
}