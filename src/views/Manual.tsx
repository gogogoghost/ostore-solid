import { createSignal, onCleanup, onMount } from 'solid-js'
import sytles from './Manual.module.scss'
import { register, unregister } from '../libs/KeyEventManager'
import { LinearFocusManager, Direction } from '../libs/LinearFocusManager'
import { installPWA } from '../api/api'
import { useNavigate } from '@solidjs/router'

export default () => {

    const [url, setUrl] = createSignal('')
    const refs: Array<HTMLElement> = []
    const navigate = useNavigate()

    const focusManager = new LinearFocusManager(Direction.Vertical)

    onMount(() => {
        focusManager.update(refs)
    })
    onCleanup(() => {
        focusManager.clean()
    })

    const onInstallPWA = async () => {
        try {
            await installPWA(url())
        } catch (e) {
            console.error(e)
            alert(e.message)
        }
    }

    const goSelectFile = () => {
        navigate("/SelectFile")
    }

    return <div class="p-8px">
        <div class={sytles.label}>Install app from sdcard</div>
        <button ref={el => refs[0] = el} onclick={goSelectFile}>Select File</button>

        <div class={sytles.label + " mt-16px"}>Install PWA from url</div>
        <input type="text" class="w-full" ref={el => refs[1] = el} value={url()} oninput={(e) => { setUrl(e.currentTarget.value) }} />
        <button class="mt-4px" ref={el => refs[2] = el} onclick={onInstallPWA}>Install PWA</button>
    </div >
}