// Vercel Function: forwards every /api/* request to the Django backend so the
// browser only ever talks to this origin (cookies stay first-party, no CORS).
// To move the backend to another host, change BACKEND_ORIGIN.
const BACKEND_ORIGIN = "https://lattice-backend-64ej.onrender.com"

// Headers that describe the hop between the browser and Vercel, not the request
// itself. fetch() recomputes them for the Render hop.
const SKIP_REQUEST_HEADERS = ["host", "connection", "content-length", "transfer-encoding"]
// fetch() already decompresses the body, so the upstream encoding/length no
// longer describe what we send back.
const SKIP_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"]

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url)
    const target = BACKEND_ORIGIN + incoming.pathname + incoming.search

    const headers = new Headers(request.headers)
    for (const name of SKIP_REQUEST_HEADERS) headers.delete(name)

    const hasBody = request.method !== "GET" && request.method !== "HEAD"
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    })

    const responseHeaders = new Headers()
    upstream.headers.forEach((value, name) => {
      // Set-Cookie can repeat and must not be merged; it is appended below.
      if (name === "set-cookie" || SKIP_RESPONSE_HEADERS.includes(name)) return
      responseHeaders.append(name, value)
    })
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  },
}
