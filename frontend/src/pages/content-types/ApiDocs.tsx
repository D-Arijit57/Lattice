import { useOutletContext } from "react-router-dom"
import { ArrowRight, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ContentType } from "@/types"

export function ApiDocs() {
  const { contentType } = useOutletContext<{ contentType: ContentType }>()

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-56 shrink-0">
        <nav className="flex flex-col space-y-1 font-medium text-sm text-neutral-600">
          <a href="#overview" className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md">Overview</a>
          <a href="#auth" className="px-3 py-2 hover:bg-neutral-50 rounded-md">Authentication</a>
          <a href="#endpoints" className="px-3 py-2 hover:bg-neutral-50 rounded-md">Endpoints</a>
          <div className="pt-2 pb-1 pl-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Entries</div>
          <a href="#list" className="px-3 py-2 hover:bg-neutral-50 rounded-md pl-6 flex items-center before:content-[''] before:w-1 before:h-1 before:bg-blue-600 before:rounded-full before:absolute relative before:left-3">List entries</a>
          <a href="#get" className="px-3 py-2 hover:bg-neutral-50 rounded-md pl-6">Get entry</a>
          <a href="#create" className="px-3 py-2 hover:bg-neutral-50 rounded-md pl-6">Create entry</a>
          <a href="#update" className="px-3 py-2 hover:bg-neutral-50 rounded-md pl-6">Update entry</a>
          <a href="#delete" className="px-3 py-2 hover:bg-neutral-50 rounded-md pl-6">Delete entry</a>
        </nav>
      </div>

      <div className="flex-1 max-w-4xl space-y-12">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold tracking-tight text-neutral-900">API</h3>
            <Button variant="outline">View in API docs <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </div>
          <p className="font-mono text-sm text-neutral-500 mb-8">Base URL: /api/v1</p>
        </div>

        <section id="list">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-bold text-neutral-900">List entries</h4>
            <Badge variant="success" className="bg-green-100 text-green-700 font-mono">GET</Badge>
            <Badge variant="secondary" className="font-mono bg-neutral-100 text-neutral-600 border-none">/api/v1/content-types/{contentType.slug}/entries/</Badge>
          </div>
          <p className="text-neutral-600 mb-6">Retrieve a list of entries for this content type.</p>

          <div className="border-b border-neutral-200 mb-6">
            <nav className="flex space-x-6">
              <button className="pb-3 text-sm font-medium border-b-2 border-blue-600 text-neutral-900">Request</button>
              <button className="pb-3 text-sm font-medium border-b-2 border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300">Response</button>
              <button className="pb-3 text-sm font-medium border-b-2 border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300">Code example</button>
            </nav>
          </div>

          <div className="bg-[#0D1117] rounded-xl overflow-hidden text-neutral-300 font-mono text-sm shadow-sm mb-8 relative group">
            <Button variant="secondary" size="sm" className="absolute top-4 right-4 h-8 bg-white/10 text-white hover:bg-white/20 border-none opacity-0 group-hover:opacity-100 transition-opacity">
              <Copy className="w-3 h-3 mr-2" /> Copy
            </Button>
            <pre className="p-6 overflow-x-auto leading-relaxed">
              <code><span className="text-pink-400">curl</span> -X GET \
  <span className="text-green-300">'https://api.yourapp.com/api/v1/content-types/{contentType.slug}/entries/'</span> \
  -H <span className="text-green-300">'Authorization: Bearer &lt;API_KEY&gt;'</span> \
  -H <span className="text-green-300">'Content-Type: application/json'</span></code>
            </pre>
          </div>

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
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="px-6 py-4 font-mono font-medium text-neutral-900">limit</td>
                  <td className="px-6 py-4 font-mono text-neutral-500">integer</td>
                  <td className="px-6 py-4 text-neutral-600">Number of results (default: 50)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-mono font-medium text-neutral-900">offset</td>
                  <td className="px-6 py-4 font-mono text-neutral-500">integer</td>
                  <td className="px-6 py-4 text-neutral-600">Pagination offset (default: 0)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-mono font-medium text-neutral-900">sort</td>
                  <td className="px-6 py-4 font-mono text-neutral-500">string</td>
                  <td className="px-6 py-4 text-neutral-600">Field to sort by (e.g. -updatedAt)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
