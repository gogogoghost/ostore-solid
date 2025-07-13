type EventMap = {
    [key: string]: Array<Array<Function>>
}

const eventMap: EventMap = {}

function getEventList(event: string): Array<Array<Function>> {
    if (!eventMap[event]) {
        const list = []
        eventMap[event] = list
        document.addEventListener(event, (evt) => {
            if (list.length > 0) {
                const targetArr = list[list.length - 1]
                for (const cb of targetArr) {
                    cb(evt)
                }
            }
        })
    }
    return eventMap[event]
}

export function register(event: string, callback: Function, override: Boolean = false) {
    const eventList = getEventList(event)
    if (override) {
        eventList.push([callback])
    } else {
        if (eventList.length > 0) {
            eventList[eventList.length - 1].push(callback)
        } else {
            eventList.push([callback])
        }
    }
}

export function unregister(event: string, callback: Function) {
    const eventList = getEventList(event)
    for (let i = 0; i < eventList.length; i++) {
        const list = eventList[i]
        let found = false
        for (let j = 0; j < list.length; j++) {
            if (list[j] == callback) {
                list.splice(j, 1)
                found = true
                break
            }
        }
        if (found) {
            if (list.length == 0) {
                eventList.splice(i, 1)
            }
            break
        }
    }
}