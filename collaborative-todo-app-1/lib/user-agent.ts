/**
 * @fileoverview User-agent → human device label.
 *
 * Active sessions store the raw `userAgent` Better Auth captured at sign-in.
 * The Account Security tab shows people a label they can recognize
 * ("Chrome on Windows"), never the raw header. Pure and client-safe.
 */

/**
 * Parse a stored user agent into a human device label.
 *
 * Returns "Unknown device" when Better Auth captured nothing (the adapter
 * stores an empty string when the header was absent) or when nothing in the
 * string is recognized.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? '').trim()
  if (!ua) return 'Unknown device'

  const browser = matchBrowser(ua)
  const os = matchOperatingSystem(ua)

  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  if (os) return `${os} device`
  return 'Unknown device'
}

function matchBrowser(ua: string): string | null {
  if (/\bEdg[a-z]*\//i.test(ua)) return 'Edge'
  if (/\bOPR\/|\bOpera\b/i.test(ua)) return 'Opera'
  if (/\bCriOS\//i.test(ua)) return 'Chrome'
  if (/\bFxiOS\//i.test(ua)) return 'Firefox'
  if (/\bChrome\//i.test(ua)) return 'Chrome'
  if (/\bFirefox\//i.test(ua)) return 'Firefox'
  if (/\bVersion\/[\d.]+.*\bSafari\//i.test(ua)) return 'Safari'
  if (/\bMSIE\b|\bTrident\//i.test(ua)) return 'Internet Explorer'
  return null
}

function matchOperatingSystem(ua: string): string | null {
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/\biPhone\b/i.test(ua)) return 'iOS'
  if (/\biPad\b/i.test(ua)) return 'iPadOS'
  if (/\bAndroid\b/i.test(ua)) return 'Android'
  if (/\bMac OS X\b/i.test(ua)) return 'macOS'
  if (/\bLinux\b/i.test(ua)) return 'Linux'
  return null
}
