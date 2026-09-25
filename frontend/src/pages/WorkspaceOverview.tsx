import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { NewContentTypeDialog } from "@/components/forms/NewContentTypeDialog"
import { contentTypes, organizations } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import { formatDate } from "@/lib/utils"

export function WorkspaceOverview() {
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const navigate = useNavigate()
  const [newOpen, setNewOpen] = useState(false)

  const organization = useApi(() => organizations.get(orgId), [orgId])
  const types = useApi(() => contentTypes.list(orgId), [orgId])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Overview</h2>
          <p className="text-neutral-500 mt-1">Your content types and quick access.</p>
        </div>
        <div className="text-sm text-neutral-500 font-medium font-mono">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="space-y-6">
        {organization.data && (
          <Card className="border-neutral-200 shadow-sm">
            <div className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <div className="w-6 h-6 bg-blue-600 rounded-sm"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{organization.data.name}</h3>
                <p className="text-sm text-neutral-500">Created {formatDate(organization.data.created_at)}</p>
              </div>
            </div>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h3 className="text-lg font-semibold text-neutral-900">Content Types</h3>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Content Type
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            {types.loading && <LoadingState />}
            {types.error != null && <ErrorState error={types.error} onRetry={types.reload} />}
            {types.data && types.data.length === 0 && (
              <EmptyState
                title="No content types yet"
                description="Create one to start defining fields and adding entries."
                action={<Button onClick={() => setNewOpen(true)}>New Content Type</Button>}
              />
            )}
            {types.data && types.data.length > 0 && (
              <div className="divide-y divide-neutral-100">
                {types.data.map((type) => (
                  <Link
                    key={type.id}
                    to={orgPath(`/content-types/${type.slug}`)}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900">{type.name}</h4>
                        <p className="text-sm font-mono text-neutral-500">{type.slug}</p>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-500 ml-4">Updated {formatDate(type.updated_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewContentTypeDialog
        orgId={orgId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(created) => {
          setNewOpen(false)
          navigate(orgPath(`/content-types/${created.slug}`))
        }}
      />
    </div>
  )
}
