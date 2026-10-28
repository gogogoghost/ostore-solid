import { createSignal, For, onCleanup, onMount } from 'solid-js'
import SoftKey from '../components/SoftKey'
import { Direction, LinearFocusManager } from '../libs/LinearFocusManager'
import {
    MODES, detectInstallMode, getAvailableModes, getInstallMode, setInstallMode,
} from '../api'
import styles from './Settings.module.scss'

export default () => {

    const [mode, setMode] = createSignal(getInstallMode())
    const [available, setAvailable] = createSignal(getAvailableModes())
    const [focusedIndex, setFocusedIndex] = createSignal(
        Math.max(0, MODES.findIndex(item => item.id === getInstallMode())))
    const rowRefs = []

    // The current mode stays reachable even when detection currently fails for
    // it; every other row must be detected to be selectable.
    const selectableIndexes = () => MODES
        .map((item, index) => index)
        .filter(index => MODES[index].id === mode() || available().includes(MODES[index].id))

    const focusManager = new LinearFocusManager(Direction.Vertical, false, (position) => {
        const index = selectableIndexes()[position]
        if (index !== undefined) setFocusedIndex(index)
    })

    const focusRow = (index) => {
        const indexes = selectableIndexes()
        focusManager.update(
            indexes.map(position => rowRefs[position]).filter(Boolean),
            Math.max(0, indexes.indexOf(index)),
        )
    }

    const refresh = () => {
        setMode(getInstallMode())
        setAvailable(getAvailableModes())
        focusRow(focusedIndex())
    }

    onMount(() => {
        focusRow(focusedIndex())
        // Detection runs once per launch; await the startup probe so a view
        // opened before it settles shows the detected state.
        detectInstallMode().then(refresh).catch(error => console.error(error))
    })

    onCleanup(() => {
        focusManager.clean()
    })

    const choose = () => {
        const selected = MODES[focusedIndex()]
        if (!selected) return
        setInstallMode(selected.id)
        setMode(selected.id)
    }

    return (<div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex-1 overflow-y-scroll p-[8px]">
            <div class="section-label">Install mode</div>
            <For each={MODES}>
                {(item, index) =>
                    <div
                        ref={el => rowRefs[index()] = el}
                        class="px-[4px] py-[5px] text-[13px]"
                        classList={{
                            [styles.selected]: focusedIndex() === index(),
                            'color-primary font-bold': item.id === mode(),
                            'color-gray': item.id !== mode() && !available().includes(item.id),
                        }}>
                        {item.label}
                    </div>
                }
            </For>
        </div>
        <div class="px-[8px] pb-[4px] text-[11px]/[13px] color-gray text-center">
            Different modes may affect the app list. AppsManager is recommended.
        </div>
        <SoftKey enter="Select" onEnterClick={choose} />
    </div>)
}
