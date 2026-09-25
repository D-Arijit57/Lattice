import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { AddFieldDialog } from "@/components/forms/AddFieldDialog"
import { fields } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import { useContentType } from "./ContentTypeWorkspace"

export function SchemaEditor() {
  const contentType = useContentType()
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const fieldList = useApi(() => fields.list(orgId, contentType.id), [orgId, contentType.id])

  // Nothing picked yet -> show the first field's details.
  const selected = fieldList.data?.find((f) => f.id === selectedId) ?? fieldList.data?.[0]

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-neutral-900">Schema</h3>
            <p className="text-sm text-neutral-500 mt-1">
              The fields every entry of this content type is made of. Fields take effect for entries once you{" "}
              <Link to={orgPath(`/content-types/${contentType.slug}/versions`)} className="text-blue-600 hover:underline">
                publish a new version
              </Link>.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add field</Button>
        </div>

        {fieldList.loading && !fieldList.data && <LoadingState />}
        {fieldList.error != null && <ErrorState error={fieldList.error} onRetry={fieldList.reload} />}
        {fieldList.data && fieldList.data.length === 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
            <EmptyState
              title="No fields yet"
              description="Add the first field, for example a title or a price."
              action={<Button onClick={() => setAddOpen(true)}>Add field</Button>}
            />
          </div>
        )}
        {fieldList.data && fieldList.data.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50/50 border-b border-neutral-100 text-neutral-500 font-medium">
                <tr>
                  <th className="px-6 py-3 w-12 text-center">#</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-center">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {fieldList.data.map((field, index) => (
                  <tr
                    key={field.id}
                    className={`hover:bg-neutral-50 cursor-pointer transition-colors ${selected?.id === field.id ? 'bg-blue-50/50 hover:bg-blue-50/50' : ''}`}
                    onClick={() => setSelectedId(field.id)}
                  >
                    <td className="px-6 py-4 text-center text-neutral-400 font-mono">{index + 1}</td>
                    <td className="px-6 py-4 font-mono font-medium text-neutral-900">{field.name}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-mono text-xs">{field.data_type}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {field.required ? (
                        <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="w-full md:w-80 shrink-0">
          <div className="sticky top-8 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
              <h4 className="font-mono font-bold text-lg text-neutral-900">{selected.name}</h4>
              <Badge variant="secondary" className="font-mono text-xs">{selected.data_type}</Badge>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-neutral-900">Field name</label>
                <Input value={selected.name} readOnly className="font-mono bg-neutral-50" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-neutral-900">Type</label>
                <Input value={selected.data_type} readOnly className="font-mono bg-neutral-50" />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={selected.required} readOnly disabled className="rounded border-neutral-300 w-4 h-4" />
                Required field
              </label>
            </div>
          </div>
        </div>
      )}

      <AddFieldDialog
        orgId={orgId}
        contentTypeId={contentType.id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(created) => {
          setAddOpen(false)
          setSelectedId(created.id)
          fieldList.reload()
        }}
      />
    </div>
  )
}
