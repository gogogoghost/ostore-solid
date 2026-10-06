

const DEVICE_STORAGE_NAME = "sdcard"

export function getDeviceStorage() {
    return navigator.b2g.getDeviceStorage(DEVICE_STORAGE_NAME)
}

export function addFileInternal(storage, blob, name) {
    return new Promise((resolve, reject) => {
        const req = storage.addNamed(blob, name)
        req.onsuccess = function () {
            resolve(this.result)
        }
        req.onerror = function () {
            reject(this.error)
        }
    })
}

export async function addFile(storage, blob, name) {
    const i = name.lastIndexOf('.')
    const prefix = name.substring(0, i)
    const suffix = name.substring(i + 1)
    let counter = 0
    while (true) {
        const realName = counter == 0 ? name : `${prefix}_${counter}.${suffix}`
        try {
            // addNamed resolves to a DOM path such as "/sdcard/tmp.zip", which
            // cannot be used as a filesystem path. The name we requested is the
            // path relative to the storage root, so return it instead.
            await addFileInternal(storage, blob, realName)
            return realName
        } catch (e) {
            if (e.message == "NoModificationAllowedError") {
                counter++;
                continue
            } else {
                throw e
            }
        }
    }
}

export async function saveFile(blob, fileName) {
    const storage = getDeviceStorage()
    const relativePath = await addFile(storage, blob, fileName)
    // storagePath is the actual mount point of the storage area. Note that
    // Directory.path from getRoot() is only a DOM path and must not be used
    // to build a filesystem path.
    const storagePath = storage.storagePath
    if (!storagePath || storagePath === "unknown") {
        throw new Error("unable to resolve device storage path: " + storagePath)
    }
    return storagePath.replace(/\/+$/, '') + '/' + relativePath
}

export async function filterZip() {
    const fileList = []
    const storage = getDeviceStorage()
    var iterable = storage.enumerate();
    var files = iterable.values();
    while (true) {
        const file = await files.next();
        if (file.done) {
            break;
        }
        if (file.value.name.endsWith('.zip')) {
            fileList.push(file.value)
        }
    }
    return fileList
}

