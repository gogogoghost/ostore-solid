import { createEffect, createMemo, createSignal, For, Index, Match, on, onCleanup, onMount, Switch } from "solid-js"
import Loading from "../components/Loading"
import AppItem from "../components/AppItem"
import SoftKey from "../components/SoftKey"
import { installedAppList, updateInstalledAppList } from "../store"
import { register, unregister } from "../libs/KeyEventManager"
import { uninstall } from '../api/api'
import { LinearFocusManager, Direction } from "../libs/LinearFocusManager"

export default () => {

    const [loading, setLoading] = createSignal(false)
    const [appList, setAppList] = createSignal([])

    const [currentIndex, setCurrentIndex] = createSignal(0)

    let refs = []

    const focusManager = new LinearFocusManager(Direction.Vertical, false, (index) => {
        setCurrentIndex(index)
    })

    createEffect(on(installedAppList, (val) => {
        setLoading(false)
        refs = []
        setAppList(val)
        queueMicrotask(() => {
            focusManager.update(refs, currentIndex())
        })
    }))

    const leftText = createMemo(() => {
        const o = appList()[currentIndex()]
        if (!o) {
            return null
        }
        if (o.name == "ostore") {
            return null
        }
        return o?.manifest_url ? 'Launch' : null
    })
    const rightText = createMemo(() => {
        const o = appList()[currentIndex()]
        if (!o) {
            return null
        }
        if (o.name == "ostore") {
            return null
        }
        return "Uninstall"
    })

    const onLeftClick = () => {
        const o = appList()[currentIndex()]
        window.open(o.manifest_url, '__blank__', "kind=app,noopener=yes")
    }
    const onRightClick = async () => {
        const o = appList()[currentIndex()]
        if (!window.confirm(`Confirm to uninstall ${o.name} ${o.version}?`)) {
            return
        }
        //find it
        try {
            await uninstall(o.manifest_url)

            //refresh list
            updateInstalledAppList()
            // show alert
            alert("Uninstall Successful")
        } catch (e) {
            console.error(e)
            alert(e.message)
        }
    }

    onMount(() => {
        focusManager.update()
        if (installedAppList().length == 0) {
            setLoading(true)
        } else {
            setAppList(installedAppList())
            queueMicrotask(() => {
                focusManager.update(refs)
            })
        }
    })

    onCleanup(() => {
        focusManager.clean()
    })

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
                                <AppItem
                                    iconSrc={item.iconSrc}
                                    name={item.name}
                                    desc={item.manifestObj.description}
                                    selected={currentIndex() == index()}
                                    version={item.version}
                                    ref={(el) => { refs[index()] = el }} />
                            }
                        </For>
                    </div>
                </Match>
            </Switch>
        </div>
        <SoftKey
            left={leftText}
            onLeftClick={onLeftClick}
            right={rightText}
            onRightClick={onRightClick}
        />
    </div>)
}
