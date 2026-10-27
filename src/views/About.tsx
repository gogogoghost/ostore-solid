import { createSignal, For, onCleanup, onMount } from 'solid-js'
import logo from '../../public/ostore_112.png'
import SoftKey from '../components/SoftKey'
import { Direction, LinearFocusManager } from '../libs/LinearFocusManager'
import {
    MODES, detectInstallMode, getAvailableModes, getInstallMode, setInstallMode,
} from '../api'

export default () => {

    const version = import.meta.env.VITE_APP_VERSION
    const [mode, setMode] = createSignal(getInstallMode())
    const [available, setAvailable] = createSignal(getAvailableModes())
    const [detecting, setDetecting] = createSignal(false)
    const [currentIndex, setCurrentIndex] = createSignal(0)
    const refs = []

    const focusManager = new LinearFocusManager(Direction.Vertical, false, (index) => {
        setCurrentIndex(index)
    })

    const refresh = () => {
        setMode(getInstallMode())
        setAvailable(getAvailableModes())
    }

    onMount(async () => {
        focusManager.update(refs)
        setDetecting(true)
        try {
            await detectInstallMode()
            refresh()
        } catch (error) {
            console.error(error)
        } finally {
            setDetecting(false)
        }
    })

    onCleanup(() => {
        focusManager.clean()
    })

    const detect = async () => {
        setDetecting(true)
        try {
            await detectInstallMode(true)
            refresh()
        } catch (error) {
            console.error(error)
            alert((error && (error.message || String(error))) || 'Detection failed')
        } finally {
            setDetecting(false)
        }
    }

    const choose = () => {
        if (detecting()) {
            return
        }
        const index = currentIndex()
        if (index === MODES.length) {
            detect()
            return
        }
        const selected = MODES[index].id
        setInstallMode(selected)
        setMode(selected)
    }

    const modeDetail = () => {
        const selected = MODES.find(item => item.id === mode())
        return selected ? selected.detail : ''
    }

    return (<div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex-1 overflow-y-scroll">
            <div class="flex flex-col items-center">
                <img src={logo} class="w-60px h-60px mt-20px" />
                <div class="text-16px font-bold">OStore</div>
                <div class="color-gray text-14px/14px">{version}</div>
                <div class="text-14px pt-16px">Orange app store for KaiOS 3.1</div>
            </div>

            <div class="px-8px pt-16px">
                <div class="text-14px font-bold">Install mode</div>
                <div class="text-12px color-gray pb-4px">
                    AppsManager installs signed store packages. The other modes install unsigned ZIPs.
                </div>
                <For each={MODES}>
                    {(item, index) =>
                        <div
                            ref={el => refs[index()] = el}
                            class="flex flex-row justify-between px-4px py-2px text-14px"
                            classList={{ 'bg-gray-200': currentIndex() === index() }}>
                            <div>{item.id === mode() ? '● ' : '○ '}{item.label}</div>
                            <div class="text-12px color-gray">
                                {available().includes(item.id) ? 'available' : 'not detected'}
                            </div>
                        </div>
                    }
                </For>
                <div
                    ref={el => refs[MODES.length] = el}
                    class="px-4px py-2px text-14px"
                    classList={{ 'bg-gray-200': currentIndex() === MODES.length }}>
                    {detecting() ? 'Detecting…' : 'Detect again'}
                </div>
                <div class="text-12px color-gray px-4px py-4px">
                    {detecting() ? 'Checking installed services…' : modeDetail()}
                </div>
            </div>
        </div>
        <SoftKey enter="Select" onEnterClick={choose} />
    </div>)
}
