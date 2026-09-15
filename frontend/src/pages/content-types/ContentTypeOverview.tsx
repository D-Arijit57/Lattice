import { useOutletContext, Link } from "react-router-dom"
import { ArrowRight, Box, Code2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ContentType } from "@/types"

export function ContentTypeOverview() {
  const { contentType } = useOutletContext<{ contentType: ContentType }>()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-neutral-100">
          <CardTitle className="text-lg font-semibold">About</CardTitle>
          <Button variant="outline" size="sm">Edit</Button>
        </CardHeader>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-3 gap-y-6 text-sm">
            <dt className="text-neutral-500">Name</dt>
            <dd className="col-span-2 font-medium text-neutral-900">{contentType.name}</dd>
            
            <dt className="text-neutral-500">Description</dt>
            <dd className="col-span-2 text-neutral-900 leading-relaxed">{contentType.description}</dd>
            
            <dt className="text-neutral-500">Current version</dt>
            <dd className="col-span-2 flex items-center gap-2">
              <span className="font-mono text-neutral-900">{contentType.currentVersion}</span>
              <Badge variant="success" className="bg-green-100 text-green-700">Current</Badge>
            </dd>
            
            <dt className="text-neutral-500">Total entries</dt>
            <dd className="col-span-2 font-medium text-neutral-900">{contentType.entriesCount.toLocaleString()}</dd>
            
            <dt className="text-neutral-500">Created</dt>
            <dd className="col-span-2 text-neutral-900">Jan 15, 2026</dd>
            
            <dt className="text-neutral-500">Updated</dt>
            <dd className="col-span-2 text-neutral-900">Sep 15, 2026</dd>
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm hover:border-blue-200 transition-colors cursor-pointer group">
          <Link to={`/content-types/${contentType.slug}/schema`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-neutral-900">Schema</h3>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Box className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">12 fields</p>
                    <p className="text-sm text-neutral-500">5 required · 3 optional · 4 rules</p>
                  </div>
                </div>
              </div>
              <span className="text-sm text-blue-600 font-medium group-hover:underline flex items-center">
                View schema <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </div>
          </Link>
        </Card>

        <Card className="shadow-sm hover:border-blue-200 transition-colors cursor-pointer group">
          <Link to={`/content-types/${contentType.slug}/entries`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-neutral-900">Entries</h3>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">{contentType.entriesCount.toLocaleString()} entries</p>
                    <p className="text-sm text-neutral-500">Last updated {contentType.updatedAt}</p>
                  </div>
                </div>
              </div>
              <span className="text-sm text-blue-600 font-medium group-hover:underline flex items-center">
                View entries <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </div>
          </Link>
        </Card>

        <Card className="shadow-sm hover:border-blue-200 transition-colors cursor-pointer group">
          <Link to={`/content-types/${contentType.slug}/api`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-neutral-900">API</h3>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">5 endpoints</p>
                    <p className="text-sm text-neutral-500">REST API (v1)</p>
                  </div>
                </div>
              </div>
              <span className="text-sm text-blue-600 font-medium group-hover:underline flex items-center">
                View API <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </div>
          </Link>
        </Card>
      </div>
    </div>
  )
}
