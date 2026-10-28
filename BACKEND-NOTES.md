# Summary

The store reads one catalogue and installs its entries with KaiOS
`AppsManager`. The previous branch merged a second GitHub catalogue and kept
raw ZIP download paths for OStore entries; those are gone because the OStore
worker now publishes JScalated-signed packages.

## Catalogue

`src/api/catalog.js` reads `all.json` and `popular.json` from
`https://dl-ostore.yexm.eu.org/`. Each row provides `id`, `name`, `desc`,
`icon`, `type`, `version`, `updateUrl`, and `history`.

- Rows are accepted only when the ID, version, and icon names are safe, the
  type is `app`, and `updateUrl` is an HTTPS pointer on the OStore origin whose
  path is `<id>_update.webmanifest`.
- `signedUpdateUrl()` inserts `_JscalatedSigned` before `.webmanifest`, matching
  the worker's stable signed pointer. That pointer's `package_path` is
  `${id}_${version}_JscalatedSigned.zip`.
- Unknown, duplicate, or uninstallable rows are skipped instead of failing the
  whole catalogue.

## Network

`src/libs/systemFetch.js` adds `mode: 'no-cors'` to every cross-origin request.
KaiOS 3 grants that mode privileged treatment to apps holding `systemXHR`: the
header list is unrestricted and a successful response is `basic` instead of
`opaque`. This replaces the per-module `XMLHttpRequest({ mozSystem: true })`
wrappers.

The appscmd daemon, the Flipfull bridge, and application vhosts are all reached
through the same helper. Opaque responses are reported as failures rather than
parsed as empty data.

## Install modes

`src/api/modes.js` owns the mode list, `localStorage` persistence, and the
fallback loop. `src/api/index.js` probes all four backends on every launch:

| Mode | Catalogue install | Manual ZIP |
| --- | --- | --- |
| `appsmanager` | signed pointer | not supported |
| `sideload` | unsigned ZIP, local install | supported |
| `flipfull` | unsigned ZIP, bridge stages the URL | supported |
| `appscmd` | unsigned ZIP, local install | supported |

The detected list and preferred mode are saved; each launch re-probes and
keeps the saved mode while it is still detected. A service-level
unavailability error (missing permission, absent scripts, dead session, refused
daemon) drops the failing mode, tries the next one, and saves the result. Real operation errors such as
an invalid ZIP are reported without retrying another backend.

Catalogue installs choose the signed or unsigned package from the mode. In
AppsManager mode, a fresh install calls `installPackage(signedUpdateUrl)`; an
installed app whose recorded URL is the same signed pointer and whose catalogue
version is newer uses `checkForUpdate` then `update(manifestUrl)`. Every other
installed state reinstalls from the signed pointer, which also migrates an
older record.

Manual ZIPs always use a local mode. Manual PWA installs and uninstalls use the
active mode first, then the remaining detected modes.

The Settings tab lists the modes, shows whether each was detected, and allows
selecting one; detection runs on every launch, so restart OStore to re-detect.
About keeps the app version information.
- The AppsManager adapter probes the firmware's generated URL encoder to choose
  a string or `URL` argument, and retries only an explicit argument-type error.
  Service, network, signature, and timeout errors are not repeated.
- On launch, a packaged OStore looks up its own installed record, checks its
  recorded update URL, and asks before updating itself.

## Permissions

The package manifest declares `b2g_features.type: "web"`, `core: true`, and
`webapps-manage`, matching the permission tier that can call AppsManager. It
also declares `systemXHR` for the privileged fetch mode and `sideload` for the
optional manual-install backend.

## Build and checks

Copy `.env.example` to `.env.production`, run `bun install`, then `./build.sh`.
Package the contents of `dist` as a ZIP with `manifest.webmanifest` at the ZIP
root. `bun run test` covers catalogue parsing, signed-pointer derivation, and
the AppsManager argument and error handling.

The build ZIP is unsigned. The companion signed ZIP produced by the worker
rewrites a public CMS digest instead of signing; it installs on unpatched
firmware but is an installer convenience, not a trust boundary. Handset
verification is still required for the signed install and self-update paths.
