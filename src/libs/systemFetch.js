// KaiOS 3 grants apps that hold the systemXHR permission privileged handling
// of `mode: 'no-cors'` requests: the request header list is unrestricted and
// a successful response is a readable `basic` response instead of an opaque
// one. Use this helper for every cross-origin request so the same code works
// for the OStore host, the local api-daemon, and application vhosts.
export function systemFetch(input, init = {}) {
  return fetch(input, { ...init, mode: 'no-cors' })
}
