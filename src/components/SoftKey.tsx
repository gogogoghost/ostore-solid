import { onCleanup, onMount } from "solid-js"
import { register, unregister } from "../libs/KeyEventManager";

export default (props) => {

    const onKeyDown = (evt) => {
        if (evt.key == 'SoftLeft' && props.left) {
            evt.preventDefault();
            props.onLeftClick?.()
        } else if (evt.key == 'SoftRight' && props.right) {
            evt.preventDefault();
            props.onRightClick?.()
        } else if (evt.key == 'Enter' && props.enter) {
            evt.preventDefault();
            props.onEnterClick?.()
        }
    }

    onMount(() => {
        register('keydown', onKeyDown)
    })

    onCleanup(() => {
        unregister('keydown', onKeyDown)
    })
    return (<div class="flex flex-row border-gray-300 border-t border-t-solid text-14px">
        <div class="invisible w-0">placeholder</div>
        <div class="flex-[1] text-left">{props.left}</div>
        <div class="flex-[1] text-center">{props.enter}</div>
        <div class="flex-[1] text-right">{props.right}</div>
    </div>)
}