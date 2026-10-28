// Identity and action rules shared by the catalogue views.
//
// The apps service identifies an installed package by its sanitised manifest
// name (`<name>.localhost`), while some AppsManager builds also report the full
// origin as `id`. Catalogue entries use their own `id`/`name`, so matching has
// to normalise both sides.

export function installedAliases(app) {
    const aliases = new Set()
    const add = value => {
        if (typeof value !== 'string') return
        const text = value.trim().toLowerCase()
        if (!text) return
        if (!text.includes('://') && !text.includes('.')) {
            aliases.add(text)
            return
        }
        try {
            const url = new URL(text.includes('://') ? text : `http://${text}`)
            if (url.hostname === 'cached.localhost') {
                const name = url.pathname.split('/').filter(Boolean)[0]
                if (name) aliases.add(name.toLowerCase())
            } else if (url.hostname.endsWith('.localhost')) {
                aliases.add(url.hostname.slice(0, -'.localhost'.length))
            }
        } catch (_) {
            aliases.add(text)
        }
    }
    add(app?.id)
    add(app?.name)
    add(app?.source)
    add(app?.origin)
    add(app?.manifest_url)
    return aliases
}

export function matchesCatalogueItem(item, installed) {
    const aliases = installedAliases(installed)
    for (const value of [item?.id, item?.name]) {
        if (typeof value === 'string' && aliases.has(value.trim().toLowerCase())) return true
    }
    const updateUrl = installed?.update_url
    return Boolean(updateUrl && (
        (item?.updateUrl && updateUrl === item.updateUrl) ||
        (item?.signedUpdateUrl && updateUrl === item.signedUpdateUrl)
    ))
}

// Several installed records can share a catalogue identity, for example an
// OStore installed without an update URL next to a copy installed from the
// signed pointer. Prefer the record that came from the signed channel.
export function bestCatalogueMatch(item, installedList) {
    const matches = (installedList || []).filter(record => matchesCatalogueItem(item, record))
    return matches.find(record => item?.signedUpdateUrl && record.update_url === item.signedUpdateUrl)
        || matches.find(record => item?.updateUrl && record.update_url === item.updateUrl)
        || matches[0]
}

// InstallPackage refuses an update URL that is already recorded as installed,
// and update() requires an update marked available by checkForUpdate, which
// only happens for a strictly newer version. AppsManager can therefore only
// upgrade a record installed from the same signed pointer. A newer catalogue
// version installed from another source cannot be updated in place; it can
// only be installed as a second copy that the user removes afterwards.
export function catalogueAction(item, mode) {
    if (!item?.installedVersion) return 'Install'
    if (mode === 'appsmanager') {
        if (item.versionState !== 1) return null
        if (item.manifestUrl && item.installedUpdateUrl === item.signedUpdateUrl) return 'Upgrade'
        return item.signedUpdateUrl ? 'Migrate' : null
    }
    if (item.versionState === -1) return 'Downgrade'
    if (item.versionState === 1) return 'Upgrade'
    return 'Reinstall'
}
