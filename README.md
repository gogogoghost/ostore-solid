# OStore-Solid

Orange app store for KaiOS 3.1

This app is built into the system image of [nokia 2780 flip](https://github.com/gogogoghost/nokia-2780-flip-jailbreak-tutorial).

## Screenshots

![](imgs/screenshot1.png)
![](imgs/screenshot2.png)
![](imgs/screenshot3.png)

## Where are the apps from?

The OStore catalogue at `https://dl-ostore.yexm.eu.org/` is the only source.

- My porting and packaging
- Uploads by authors

OStore does not read a third-party catalogue. Every listed app has a stable
`<id>_update.webmanifest` pointer, and OStore installs the signed variant
(`<id>_update_JscalatedSigned.webmanifest`) through KaiOS `AppsManager`.
AppsManager records that URL, so later launches can check the same source for
updates.

## How to upload your app

OStore has an api to publish your newest version.

https://api-ostore.yexm.eu.org/publish

POST multipart/form-data

| Field | Type   | Description          |
|-------|--------|----------------------|
| id    | string | App's ID             |
| file  | file   | Zip File             |
| sign  | file   | The ED25519 signature binary of the ZIP file  |

But for the first version you have to send the zip file and the DER format ed25519 public key to my email: **jaxyang39@gmail.com**.

I will publish your first version and then you can upgrade by yourself.

The publishing service rebuilds the catalogue, the unsigned update pointer, and
the signed update pointer. See the companion `ostore-worker` repository for the
artifact layout and retention rules.

## Install modes

On every launch OStore probes the four install backends. It keeps the saved
mode when it is still detected and otherwise takes the first available one:

1. `AppsManager` - installs the signed `*_JscalatedSigned.webmanifest` pointer.
2. `Sideload` - installs the unsigned `<id>_<version>.zip`.
3. `Flipfull` - installs the unsigned ZIP through its bridge.
4. `appscmd` - installs the unsigned ZIP through the local daemon.

The choice is stored in `localStorage` and preferred while it stays detected.
If a saved mode reports that its service is unavailable, OStore falls back to
the next mode and saves the new choice. The Settings tab shows the current mode
and detected availability; pressing Enter on a mode switches to it
immediately. Restart OStore to run detection again.

A ZIP on the memory card always uses an available local mode (Sideload,
Flipfull, or appscmd) because AppsManager cannot install a local file. A PWA
URL under Manual Install uses the active mode when it supports `installPwa`.

Network requests use `fetch(..., { mode: 'no-cors' })`. On KaiOS 3 the
`systemXHR` permission makes that a readable privileged response, which is
required because the OStore download host does not send CORS headers.

## Development

```bash
cp .env.example .env
bun install
bun run dev
```

`bun run test` runs the catalogue and AppsManager unit checks. `./build.sh`
produces `dist/ostore.zip` with `manifest.webmanifest` at the ZIP root.
