import { Index, onCleanup, onMount } from "solid-js"
import styles from './Tab.module.scss'
import { Direction, LinearFocusManager } from "../libs/LinearFocusManager";

export default (props) => {
    const refs: HTMLElement[] = [];

    const tabList = ['Popular', 'All', 'Installed', 'Manual Install', 'About']

    const focusManager = new LinearFocusManager(Direction.Horizontal, true, (index) => {
        props.onIndexChange(index)
    })

    onMount(() => {
        focusManager.update(refs, props.current)
    })
    onCleanup(() => {
        focusManager.clean()
    })
    return (
        <div class="flex flex-row overflow-x-hidden w-full">
            <Index each={tabList}>
                {(item, index) =>
                    <div
                        ref={elRef => {
                            refs[index] = elRef
                        }}
                        class={styles.tab + " text-center px-[4px] py-[2px] text-[14px]"}
                        classList={{ [styles.current]: props.current == index }}>
                        {item()}<div>{item()}</div>
                    </div>
                }
            </Index >
        </div >
    )
}