import { onCleanup, onMount } from 'solid-js'
import styles from './Dialog.module.scss'
import { register, unregister } from '../libs/KeyEventManager'

export default (props) => {

    const onKeyDown = () => { }

    onMount(() => {
        register('keydown', onKeyDown, true)
    })
    onCleanup(() => {
        unregister('keydown', onKeyDown)
    })

    return (<div class={styles.modal}>
        <div class={styles.content}>
            {props.children}
        </div>
    </div>)
}