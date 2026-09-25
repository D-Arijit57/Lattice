import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { errorMessage, versions } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId } from "@/lib/use-org"
import { formatDateTime } from "@/lib/utils"
import { useContentType } from "./ContentTypeWorkspace"

export function SchemaVersions() {
  const contentType = useContentType()
  const orgId = useOrgId()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const versionList = useApi(() => versions.list(orgId, contentType.id), [orgId, contentType.id])

  // The API lists versions newest first; nothing picked yet -> show the newest.
  const latest = versionList.data?.[0]
  const selected = versionList.data?.find((v) => v.id === selectedId) ?? latest

  async function publish() {
    setPublishing(true)
    setPublishError(null)
    try {
      // The server builds the schema from the current Fields; there is no body to send.
      const created = await versions.create(orgId, contentType.id)
      setSelectedId(created.id)
      versionList.reload()
    } catch (err) {
      // e.g. "Cannot create a version: this ContentType has no Fields defined."
      setPublishError(errorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-neutral-900">Schema Versions</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Each version is a frozen snapshot of the fields. Entries are validated against the newest one.
          </p>
        </div>
        <Button onClick={publish} disabled={publishing}>
          <Plus className="w-4 h-4 mr-2" /> {publishing ? "Publishing..." : "New version"}
        </Button>
      </div>

      {publishError && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{publishError}</p>
      )}

      {versionList.loading && !versionList.data && <LoadingState />}
      {versionList.error != null && <ErrorState error={versionList.error} onRetry={versionList.reload} />}
      {versionList.data && versionList.data.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <EmptyState
            title="No versions yet"
            description="Add fields on the Schema tab, then publish the first version."
          />
        </div>
      )}

      {versionList.data && selected && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-neutral-200"></div>

            <div className="space-y-6">
              {versionList.data.map((version) => (
                <div key={version.id} className="relative pl-12">
                  <div className="absolute left-[13px] top-5 w-2 h-2 rounded-full bg-neutral-400 border-2 border-white ring-2 ring-transparent"></div>

                  <button
                    type="button"
                    onClick={() => setSelectedId(version.id)}
                    className={`block w-full text-left p-6 rounded-xl border transition-colors ${selected.id === version.id ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-50' : 'bg-neutral-50/50 border-neutral-200 hover:bg-white hover:border-neutral-300'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="font-mono text-lg font-bold text-neutral-900">v{version.version_number}</h4>
                      {version.id === latest?.id && (
                        <Badge variant="success" className="bg-green-100 text-green-700">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-neutral-500">
                      <span>{formatDateTime(version.created_at)}</span>
                      <span className="font-medium text-neutral-700">
                        {Object.keys(version.schema.properties).length} fields
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-80 shrink-0">
            <div className="sticky top-8 bg-neutral-50 rounded-xl border border-neutral-200 p-6">
              <h4 className="font-semibold text-neutral-900 mb-6">Version details</h4>

              <dl className="space-y-4 text-sm mb-8">
                <div className="grid grid-cols-3">
                  <dt className="text-neutral-500">Version</dt>
                  <dd className="col-span-2 font-mono font-medium text-neutral-900">v{selected.version_number}</dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-neutral-500">Created</dt>
                  <dd className="col-span-2 text-neutral-900">{formatDateTime(selected.created_at)}</dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-neutral-500">Fields</dt>
                  <dd className="col-span-2 font-medium text-neutral-900">{Object.keys(selected.schema.properties).length}</dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-neutral-500">Required</dt>
                  <dd className="col-span-2 font-medium text-neutral-900">{selected.schema.required.length}</dd>
                </div>
              </dl>

              <h5 className="font-semibold text-neutral-900 mb-3">Schema</h5>
              <pre className="rounded-lg bg-neutral-900 text-neutral-100 text-xs p-4 overflow-x-auto">
                <code>{JSON.stringify(selected.schema, null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
