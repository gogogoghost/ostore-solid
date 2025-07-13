import { createSignal, For, onMount } from "solid-js"
import SoftKey from "../components/SoftKey"
import Title from "../components/Title"
import { Show } from "solid-js"
import Loading from "../components/Loading"
import styles from './SelectFile.module.scss'
import cogBox from '../assets/cog-box.svg'
import { Direction, LinearFocusManager } from "../libs/LinearFocusManager"
import { saveFile } from '../libs/utils'
import { install } from '../api/api'

export default () => {

    const [loading, setLoading] = createSignal(false)
    const [currentIndex, setCurrentIndex] = createSignal(0)
    const [list, setList] = createSignal([])
    const refs = []
    const focusManager = new LinearFocusManager(Direction.Vertical, false, (index) => {
        setCurrentIndex(index)
    })

    const filterZip = async () => {
        const fileList = []
        const sdcard = navigator.b2g.getDeviceStorage("sdcard");
        var iterable = sdcard.enumerate();
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

    onMount(async () => {
        focusManager.update()
        setLoading(true)
        try {
            setList(await filterZip())
            queueMicrotask(() => {
                focusManager.update(refs)
            })
        } catch (e) {
            console.error(e)
            alert(e.message || "Unkown Error")
        }
        finally {
            setLoading(false)
        }

    })

    const onEnterClick = async () => {
        const file = list()[currentIndex()]
        if (!window.confirm(`Confirm to install '${file.name}'?`)) {
            return
        }
        try {
            const fullPath = await saveFile(file, "tmp.zip")
            await install(fullPath)
        } catch (e) {
            console.error(e)
            alert(e.message)
        }
    }

    return (<div class="flex flex-col h-full">
        <Title />
        <Show when={loading()}>
            <div class="flex-1 flex justify-center items-center">
                <Loading />
            </div>
        </Show>
        <Show when={!loading()}>
            <Show when={list().length > 0}>
                <div class="flex-1 overflow-y-scroll">
                    <For each={list()}>
                        {(item, index) =>
                            <div class="flex flex-row" classList={{ [styles.selected]: index() == currentIndex() }} ref={el => refs[index()] = el}>
                                <img src={cogBox} class={styles['img-filter'] + " w-40px h-40px"} />
                                <div class="p-4px">{item.name}</div>
                            </div>
                        }
                    </For>
                </div>
                <SoftKey enter="Install" onEnterClick={onEnterClick}></SoftKey>
            </Show >
            <Show when={list().length == 0}>
                <div class="flex-1 flex justify-center items-center">
                    No zip files found
                </div>
            </Show>
        </Show >

    </div >)
}