import { createSignal, onMount, Show } from "solid-js"
import sytles from './AppItem.module.scss'
import defaultLogo from '../../public/kaios_56.png'

export default (props) => {

    let ref;

    onMount(() => {
        props.ref?.(ref)
    })


    const [error, setError] = createSignal(false)

    return (<div class="flex flex-row p-[4px]" classList={{ [sytles.selected]: props.selected }} ref={ref}>
        <Show when={error()} fallback={<img src={props.iconSrc} class={sytles.icon} onerror={() => { setError(true) }} />}>
            <img src={defaultLogo} class={sytles.icon} />
        </Show>
        <div class="ms-[4px]">
            <div class="text-[16px]/[17px] font-bold my-1px">
                {props.name}
                <span class="text-[12px]/[12px] ms-[6px] color-emerald-600">{props.version}</span>
            </div>
            <Show when={props.installedVersion?.()}>
                <div class={sytles['installed-version']}>
                    <span>Installed: {props?.installedVersion()}</span>
                </div>
            </Show>
            <div class="text-[12px]/[13px] line-clamp-2 overflow-hidden text-ellipsis">{props.desc}</div>
        </div>
    </div>)
}