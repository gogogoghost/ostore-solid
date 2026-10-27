// Classic scripts served by api-daemon. Concurrent callers share one script
// element, and a failed load is forgotten so a later attempt can retry.
const pending = new Map()

export function loadScript(src, timeoutMs = 12000) {
  if (pending.has(src)) return pending.get(src)
  const promise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      script.remove()
      reject(new Error(`Timed out loading ${src}`))
    }, timeoutMs)
    script.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      reject(new Error(`Could not load ${src}`))
    }
    script.src = src
    document.head.appendChild(script)
  }).catch(error => {
    pending.delete(src)
    throw error
  })
  pending.set(src, promise)
  return promise
}
