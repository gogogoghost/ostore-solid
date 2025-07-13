import { createEffect, createSignal } from "solid-js"

const store = {}

export function createPersistenceSignal<T>(value: T, name: string) {
    const [getter, setter] = createSignal(value)
    if (store[name] != undefined) {
        setter(store[name])
    }
    createEffect(() => {
        store[name] = getter()
    })
    return [getter, setter]
}