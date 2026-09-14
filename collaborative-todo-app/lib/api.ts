// Use an absolute base URL only when running on the server during prefetch.
// On the client, relative URLs work fine.
function getBase() {
  if (typeof window === "undefined") {
    // Server-side: Next.js needs a full URL for fetch()
    const port = process.env.PORT ?? 3000;
    return `http://localhost:${port}`;
  }
  return "";
}

export async function fetcher(url: string) {
  const res = await fetch(`${getBase()}${url}`)
  if (!res.ok) throw new Error('Network response was not ok')
  return res.json()
}