// import type { List } from "@/types/list";

// // Use an absolute base URL only when running on the server during prefetch.
// // On the client, relative URLs work fine.
// function getBase() {
//   if (typeof window === "undefined") {
//     // Server-side: Next.js needs a full URL for fetch()
//     const port = process.env.PORT ?? 3000;
//     return `http://localhost:${port}`;
//   }
//   return "";
// }

// export async function fetchLists(): Promise<List[]> {
//   const res = await fetch(`${getBase()}/api/lists`);
//   if (res.status === 401) {
//     // Only redirect on the client — on the server during prefetch,
//     // window is undefined and getRequiredSession() handles auth.
//     if (typeof window !== "undefined") {
//       window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
//     }
//     // Throw so TanStack Query doesn't try to cache `undefined` while the
//     // redirect is in flight (or so server-side callers know auth failed).
//     throw new Error("Unauthorized");
//   }

//   if (!res.ok) throw new Error("Failed to fetch lists");

//   return res.json();
// }

// export async function fetchList(id: string): Promise<List> {
//   const res = await fetch(`${getBase()}/api/lists/${id}`);
//   if (res.status === 401) {
//     // Only redirect on the client — on the server during prefetch,
//     // window is undefined and getRequiredSession() handles auth.
//     if (typeof window !== "undefined") {
//       window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
//     }
//     // Throw so TanStack Query doesn't try to cache `undefined` while the
//     // redirect is in flight (or so server-side callers know auth failed).
//     throw new Error("Unauthorized");
//   }

//   if (!res.ok) throw new Error(`Failed to fetch list ${id}`);

//   return res.json();
// }


//==============================================================================


import type { List } from "@/types/list";

function getBase() {
  if (typeof window === "undefined") {
    const port = process.env.PORT ?? 3000;
    return `http://localhost:${port}`;
  }
  return "";
}

export async function fetchLists(): Promise<List[]> {
  const res = await fetch(`${getBase()}/api/lists`);
  if (res.status === 401) {
    // On the server during prefetch, return empty so the page still renders.
    // The client will re-fetch with the real session cookie.
    if (typeof window === "undefined") return [];
    window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    throw new Error('Unauthorized')
  }
  
  if (!res.ok) throw new Error("Failed to fetch lists");
  
  return res.json();
}

export async function fetchList(id: string): Promise<List> {
  const res = await fetch(`${getBase()}/api/lists/${id}`);
  if (res.status === 401) {
    if (typeof window === "undefined") throw new Error('Unauthorized');
    window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    throw new Error('Unauthorized')
  }
  
  if (!res.ok) throw new Error(`Failed to fetch list ${id}`);
  
  return res.json();
}