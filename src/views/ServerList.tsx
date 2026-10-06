import { createEffect, createMemo, createSignal, ErrorBoundary, For, Index, Match, on, onCleanup, onMount, Show, Switch } from "solid-js"
import SoftKey from "../components/SoftKey"
import Loading from "../components/Loading"
import AppItem from "../components/AppItem"
import { getAllList, getPopularList, install, resourceUrl, uninstall } from '../api';
import { installedAppList, updateInstalledAppList } from "../store";
import { register, unregister } from "../libs/KeyEventManager";
import Dialog from "../components/Dialog";
import { saveFile } from '../libs/utils.js'
import { LinearFocusManager, Direction } from "../libs/LinearFocusManager";

export default (props) => {

    const [loading, setLoading] = createSignal(false)
    const [appList, setAppList] = createSignal([])

    const [currentIndex, setCurrentIndex] = createSignal(0)

    let refs = []

    const focusManager = new LinearFocusManager(Direction.Vertical, false, (index) => {
        setCurrentIndex(index)
    })

    const [dialogMessage, setDialogMessage] = createSignal('')
    const [showDialog, setShowDialog] = createSignal(false)

    const leftText = createMemo(() => {
        const o = appList()[currentIndex()]
        if (!o) {
            return null
        }
        if (o.id == "ostore") {
            return null
        }
        return o?.manifestUrl ? 'Launch' : null
    })
    const enterText = createMemo(() => {
        const o = appList()[currentIndex()]
        if (!o) {
            return null
        }
        if (!o.installedVersion) {
            return "Install"
        }
        if (o.versionState == -1) {
            return "Downgrade"
        } else if (o.versionState == 0) {
            return "Reinstall"
        } else if (o.versionState == 1) {
            return "Upgrade"
        }
    })
    const rightText = createMemo(() => {
        const o = appList()[currentIndex()]
        if (!o) {
            return null
        }
        if (!o.installedVersion) {
            return null
        }
        if (o.id == "ostore") {
            return null
        }
        return "Uninstall"
    })

    const compareVersions = (version1, version2) => {
        const v1 = String(version1 ?? '').split('.').map(Number);
        const v2 = String(version2 ?? '').split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (v1[i] > v2[i]) {
                return 1;
            }
            if (v1[i] < v2[i]) {
                return -1;
            }
        }
        return 0;
    }

    const updateInstalledVersion = () => {
        const list = []
        for (const srcItem of appList()) {
            const item = { ...srcItem }
            const obj = installedAppList().find(o => o.name == item.id)
            if (obj) {
                item.installedVersion = obj.version
                item.versionState = (typeof item.version === 'string' && typeof obj.version === 'string')
                    ? compareVersions(item.version, obj.version)
                    : null
                item.manifestUrl = obj.manifest_url
            } else {
                item.installedVersion = null
                item.versionState = null
                item.manifestUrl = null
            }
            list.push(item)
        }
        setAppList(list)
    }

    // `defer: false` so the effect also runs when the list was already
    // populated before this view mounted.
    createEffect(on(installedAppList, () => {
        updateInstalledVersion()
    }, { defer: false }))

    onMount(async () => {
        focusManager.update()
        setLoading(true)
        try {
            const res = await (props.all ? getAllList() : getPopularList())
            for (const item of res) {
                item.iconSrc = resourceUrl + item.icon
                item.fileName = item.id + '_' + item.version + '.zip'
                item.url = resourceUrl + item.fileName
            }
            setAppList(res)
            if (installedAppList().length > 0) {
                updateInstalledVersion()
            }
            queueMicrotask(() => {
                focusManager.update(refs)
            })
        } catch (e) {
            console.error(e)
            alert(e.message || "Unkown Error")
        } finally {
            setLoading(false)
        }
    })

    onCleanup(() => {
        focusManager.clean()
    })


    const handleLaunch = () => {
        const o = appList()[currentIndex()]
        window.open(o.manifestUrl, '__blank__', "kind=app,noopener=yes")
    }

    const handleInstall = async () => {
        const o = appList()[currentIndex()]
        if (!window.confirm(`Confirm to install ${o.name} ${o.version}?`)) {
            return
        }
        try {
            setShowDialog(true)
            setDialogMessage("Downloading...")
            const res = await (await fetch(o.url)).blob()
            const fullPath = await saveFile(res, o.fileName)

            setDialogMessage("Installing...")
            // alert(fullPath)
            await install(fullPath)

            // refresh list
            updateInstalledAppList()
            // show alert
            if (o.id == "ostore") {
                alert("Install Successful. OStore will restart automatically")
                window.location.reload();
            } else {
                alert("Install Successful")
            }
        } catch (e) {
            // SecurityError
            console.error(e)
            alert(e.message)
        } finally {
            setShowDialog(false)
        }
    }
    const handleUninstall = async () => {
        const o = appList()[currentIndex()]
        if (!window.confirm(`Confirm to uninstall ${o.name} ${o.version}?`)) {
            return
        }
        //find it
        try {
            setShowDialog(true)
            setDialogMessage("Uninstalling...")
            await uninstall(o.manifestUrl)

            //refresh list
            updateInstalledAppList()
            // show alert
            alert("Uninstall Successful")
        } catch (e) {
            console.error(e)
            alert(e.message)
        } finally {
            setShowDialog(false)
        }
    }


    return (<div class="flex flex-col flex-1 overflow-y-scroll">
        <div class="flex-1 overflow-y-scroll">
            <Switch>
                <Match when={loading()}>
                    <div class="w-full h-full flex justify-center items-center">
                        <Loading />
                    </div>
                </Match>
                <Match when={!loading()}>
                    <div>
                        <For each={appList()}>
                            {(item, index) =>
                                // One broken entry must not take the whole list down.
                                <ErrorBoundary fallback={<div class="p-[4px] text-[13px]">{String(item?.name)}: failed to display</div>}>
                                    <AppItem
                                        iconSrc={item.iconSrc}
                                        name={item.name}
                                        desc={item.desc}
                                        selected={currentIndex() == index()}
                                        version={item.version}
                                        installedVersion={() => item.installedVersion}
                                        ref={(el) => { refs[index()] = el }} />
                                </ErrorBoundary>
                            }
                        </For>
                    </div>
                </Match>
            </Switch>
        </div>
        <SoftKey
            left={leftText} onLeftClick={handleLaunch}
            enter={enterText} onEnterClick={handleInstall}
            right={rightText} onRightClick={handleUninstall}
        />

        <Show when={showDialog()}>
            <Dialog>
                <div class="flex flex-col items-center py-20px">
                    <Loading></Loading>
                    <div>{dialogMessage()}</div>
                </div>
            </Dialog>
        </Show>

    </div>)
}