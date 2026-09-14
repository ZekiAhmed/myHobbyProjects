// lib/utils/api-fetch.ts
//
// Shared fetch helper for query functions. Instead of blindly calling
// .json() (which explodes on an HTML error page), this checks the status
// first. On 401 it sends the user to sign-in itself, since a stale/expired
// session should feel like "please log in again," not a crash.
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)

  if (res.status === 401) {
    window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    // Throw so TanStack Query doesn't try to cache `undefined` while the
    // redirect is in flight.
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status}`)
  }

  return res.json()
}