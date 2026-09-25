import { Link } from "react-router-dom"
import { ArrowRight, Box, Code2, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { fields, versions } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import { formatDate } from "@/lib/utils"
import { useContentType } from "./ContentTypeWorkspace"

export function ContentTypeOverview() {
  const contentType = useContentType()
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const basePath = orgPath(`/content-types/${contentType.slug}`)

  // Two small calls give the real numbers the summary cards need.
  const fieldList = useApi(() => fields.list(orgId, contentType.id), [orgId, contentType.id])
  const versionList = useApi(() => versions.list(orgId, contentType.id), [orgId, contentType.id])

  if (fieldList.loading || versionList.loading) return <LoadingState />
  const failed = fieldList.error ?? versionList.error
  if (failed) {
    return <ErrorState error={failed} onRetry={() => { fieldList.reload(); versionList.reload() }} />
  }

  const fieldCount = fieldList.data?.length ?? 0
  const requiredCount = fieldList.data?.filter((f) => f.required).length ?? 0
  // The API lists versions newest first.
  const latest = versionList.data?.[0]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b border-neutral-100">
          <CardTitle className="text-lg font-semibold">About</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-3 gap-y-6 text-sm">
            <dt className="text-neutral-500">Name</dt>
            <dd className="col-span-2 font-medium text-neutral-900">{contentType.name}</dd>

            <dt className="text-neutral-500">Slug</dt>
            <dd className="col-span-2 font-mono text-neutral-900">{contentType.slug}</dd>

            <dt className="text-neutral-500">Current version</dt>
            <dd className="col-span-2 flex items-center gap-2">
              {latest ? (
                <>
                  <span className="font-mono text-neutral-900">v{latest.version_number}</span>
                  <Badge variant="success" className="bg-green-100 text-green-700">Current</Badge>
                </>
              ) : (
                <span className="text-neutral-500">None published yet</span>
              )}
            </dd>

            <dt className="text-neutral-500">Created</dt>
            <dd className="col-span-2 text-neutral-900">{formatDate(contentType.created_at)}</dd>

            <dt className="text-neutral-500">Updated</dt>
            <dd className="col-span-2 text-neutral-900">{formatDate(contentType.updated_at)}</dd>
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm hover:border-blue-200 transition-colors cursor-pointer group">
          <Link to={`${basePath}/schema`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Schema</h3>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Box className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">{fieldCount} {fieldCount === 1 ? "field" : "fields"}</p>
                    <p className="text-sm text-neutral-500">{requiredCount} required · {fieldCount - requiredCount} optional</p>
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
          <Link to={`${basePath}/entries`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Entries</h3>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Browse and add entries</p>
                    <p className="text-sm text-neutral-500">
                      {latest ? `Validated against v${latest.version_number}` : "Publish a version first"}
                    </p>
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
          <Link to={`${basePath}/api`}>
            <div className="p-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">API</h3>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">List, get and create entries</p>
                    <p className="text-sm text-neutral-500">REST API</p>
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
