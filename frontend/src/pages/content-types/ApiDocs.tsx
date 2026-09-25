import type { ReactNode } from "react"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useOrgId } from "@/lib/use-org"
import { useContentType } from "./ContentTypeWorkspace"

// The API is reached through the same origin as this app. VITE_API_BASE_URL
// may be relative ("/api") or absolute, so resolve it against the page's own
// address to show something a person can actually paste into a terminal.
const API_BASE = new URL(import.meta.env.VITE_API_BASE_URL, window.location.origin).href.replace(/\/$/, "")

export function ApiDocs() {
  const contentType = useContentType()
  const orgId = useOrgId()

  const entriesPath = `/organizations/${orgId}/content-types/${contentType.id}/entries/`
  const listCurl = `curl -X GET \\
  '${API_BASE}${entriesPath}' \\
  -b cookies.txt`
  const createCurl = `curl -X POST \\
  '${API_BASE}${entriesPath}' \\
  -b cookies.txt \\
  -H 'Content-Type: application/json' \\
  -d '{"data": {"title": "Hello"}}'`
  const loginCurl = `curl -X POST '${API_BASE}/auth/login/' \\
  -c cookies.txt \\
  -H 'Content-Type: application/json' \\
  -d '{"email": "you@example.com", "password": "..."}'`

  return (
    <div className="max-w-4xl space-y-12">
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">API</h3>
        <p className="font-mono text-sm text-neutral-500">Base URL: {API_BASE}</p>
        <p className="text-neutral-600 mt-4">
          Requests are authenticated with the session cookies set at login (there are no API keys).
          Sign in once, keep the cookies, and send them with every call.
        </p>
      </div>

      <Endpoint
        title="Sign in"
        method="POST"
        path="/auth/login/"
        description="Sets the access and refresh cookies. Save them with -c and send them back with -b."
        code={loginCurl}
      />

      <Endpoint
        title="List entries"
        method="GET"
        path={entriesPath}
        description="Newest first, 50 per page across all versions. The response has next and previous; next ends in ?cursor=... - pass that cursor to get the following page."
        code={listCurl}
      >
        <h5 className="font-semibold text-neutral-900 mb-4">Query parameters</h5>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50/50 border-b border-neutral-100 text-neutral-500 font-medium">
              <tr>
                <th className="px-6 py-3">Parameter</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-4 font-mono font-medium text-neutral-900">cursor</td>
                <td className="px-6 py-4 font-mono text-neutral-500">string</td>
                <td className="px-6 py-4 text-neutral-600">Opaque position from the previous response's next link.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Endpoint>

      <Endpoint
        title="Create entry"
        method="POST"
        path={entriesPath}
        description="The entry is validated against the newest published version. Errors come back per field, all at once."
        code={createCurl}
      />

      <Endpoint
        title="Get entry"
        method="GET"
        path={`${entriesPath}{id}/`}
        description="One entry by id."
      />
    </div>
  )
}

function Endpoint({
  title,
  method,
  path,
  description,
  code,
  children,
}: {
  title: string
  method: "GET" | "POST"
  path: string
  description: string
  code?: string
  children?: ReactNode
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h4 className="text-lg font-bold text-neutral-900">{title}</h4>
        <Badge variant="success" className="bg-green-100 text-green-700 font-mono">{method}</Badge>
        <Badge variant="secondary" className="font-mono bg-neutral-100 text-neutral-600 border-none break-all">
          {path}
        </Badge>
      </div>
      <p className="text-neutral-600 mb-6">{description}</p>

      {code && (
        <div className="bg-[#0D1117] rounded-xl overflow-hidden text-neutral-300 font-mono text-sm shadow-sm mb-8 relative group">
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 h-8 bg-white/10 text-white hover:bg-white/20 border-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            <Copy className="w-3 h-3 mr-2" /> Copy
          </Button>
          <pre className="p-6 overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      )}

      {children}
    </section>
  )
}
