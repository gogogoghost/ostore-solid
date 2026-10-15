# Summary

This branch is based on `gogogoghost/ostore-solid` master at `db4a0286ad8848fb7da6b52d75a1946b0c090336` (2026-10-14), including the new Flipfull backend. The upstream package is version 1.2.2. This test build identifies itself as 1.2.4 so an installed 1.2.3 package can request an update. The app's visible JSX and CSS are unchanged.

## Catalogues

The built-in list has exactly two sources:

- `https://Garbagebuild.github.io/JScalated-Store/webapps.json`
- `https://dl-ostore.yexm.eu.org/all.json` and `popular.json`

Both load independently. A failure in one source leaves the other available. Duplicate app IDs prefer the JScalated entry because it provides an AppsManager update manifest. OStore's download host lacks the CORS headers needed for ordinary browser fetch responses, so only OStore requests use `mozSystem` XMLHttpRequest as a fallback.

## Install paths

- JScalated apps call AppsManager `installPackage(updateUrl)` or, for an installed app, `checkForUpdate` followed by `update(manifestUrl)`.
- The AppsManager adapter checks the local generated encoder to select a URL string or URL object. It retries the other representation only when the encoder reports an explicit argument type mismatch. A service, network, signature, or timeout error is returned without repeating an operation that may have started.
- OStore's API publishes raw ZIP downloads, not AppsManager update manifests. Those entries retain the existing Sideload, Flipfull, and appscmd install paths. Flipfull stages the URL itself; the other two use a local download. Manual ZIP installs continue through those backends too.
- The legacy appscmd HTTP fallback now uses a scoped system XMLHttpRequest on KaiOS. It no longer changes `window.fetch` for the entire app.
- The package and update manifests declare `b2g_features.type: "web"`, `core: true`, and `webapps-manage`, matching the working JScalated Store permission tier. An earlier OStore 1.2.3 package declared the permission without `core: true`; on the test handset AppsManager returned “missing permission” when OStore itself tried to install an app.
- On launch, packaged OStore uses AppsManager to find its own installed `updateUrl`, checks it for a newer package, and asks before updating itself. This uses the URL recorded at installation. The current LAN test URL requires the computer server to be reachable; a future internet release needs a stable HTTPS update source.

## Build and checks

Copy `.env.example` to `.env.production`, run `npm install`, then run `npm run build`. Package the contents of `dist` as a ZIP with `manifest.webmanifest` at the ZIP root. `node tools/backend.test.mjs` checks catalog isolation and both AppsManager argument representations.

The build ZIP is unsigned. The companion ZIP produced by the JScalated Python signing tool is a signature test fixture: it copies CMS signature bytes without the private key and fails cryptographic verification. Only a package signed by a trusted key can satisfy production signature checks, and actual installation still needs testing on the target handset with the required `webapps-manage`, `systemXHR`, and local-install permissions.

# Conclusion

The source and build contain the two catalogues, both install paths, and a self-update check. Version 1.2.3 installed on the test handset but lacked the privilege tier needed to call AppsManager from inside OStore. Version 1.2.4 handset installation and app installs remain to be verified.
