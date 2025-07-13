import { register, unregister } from './KeyEventManager'

export enum Direction {
    Horizontal,
    Vertical
}

export class LinearFocusManager {
    hasRegisted = false
    hasClean = false
    index = 0
    refs: Array<HTMLElement> = []
    onIndexChangeCallback: Function | null = null
    action: Array<String>
    scrollArgs: Object
    noFocus: boolean
    constructor(direction: Direction, noFocus: boolean = false, onIndexChangeCallback: Function | null = null) {
        if (direction == Direction.Vertical) {
            this.action = ["ArrowUp", "ArrowDown"]
            this.scrollArgs = { behavior: 'smooth', block: 'center' }
        } else {
            this.action = ["ArrowLeft", "ArrowRight"]
            this.scrollArgs = { behavior: 'smooth', inline: 'center' }
        }
        this.noFocus = noFocus
        this.onIndexChangeCallback = onIndexChangeCallback
    }
    private onKeyDown = (evt) => {
        if (this.refs.length == 0) {
            return
        }
        if (evt.key == this.action[0]) {
            if (this.index == 0) {
                this.index = this.refs.length - 1
            } else {
                this.index--
            }
            evt.preventDefault();
            this.focus(this.refs[this.index]);
        } else if (evt.key == this.action[1]) {
            if (this.index == this.refs.length - 1) {
                this.index = 0
            } else {
                this.index++
            }
            evt.preventDefault();
            this.focus(this.refs[this.index]);
        }
    }
    private focus(el: HTMLElement) {
        if (!this.noFocus) {
            el.focus()
        }
        el.scrollIntoView(this.scrollArgs)
        this.onIndexChangeCallback?.(this.index)
    }
    focusIndex(index: number) {
        if (this.refs[index]) {
            this.index = index
            this.focus(this.refs[index]);
        }
    }
    update(refs: Array<HTMLElement> = [], initialIndex: number = 0) {
        if (this.hasClean) {
            return
        }
        if (!this.hasRegisted) {
            register('keydown', this.onKeyDown)
            this.hasRegisted = true
        }
        this.refs = refs
        this.focusIndex(initialIndex)
    }
    clean() {
        unregister('keydown', this.onKeyDown)
        this.hasClean = true
    }
}