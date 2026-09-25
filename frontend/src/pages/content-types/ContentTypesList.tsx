import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { NewContentTypeDialog } from "@/components/forms/NewContentTypeDialog"
import { contentTypes } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import { formatDate } from "@/lib/utils"

export function ContentTypesList() {
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [newOpen, setNewOpen] = useState(false)

  const types = useApi(() => contentTypes.list(orgId), [orgId])

  // The API returns the whole list (a plain array), so searching it in the
  // browser is enough - no server-side search exists or is needed.
  const query = search.trim().toLowerCase()
  const visible = (types.data ?? []).filter(
    (type) => type.name.toLowerCase().includes(query) || type.slug.includes(query),
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Content Types</h2>
          <p className="text-neutral-500 mt-1">Define and manage the structured data models used by your organization.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Content Type</Button>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="Search content types..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium text-neutral-900">
                      <Link to={orgPath(`/content-types/${type.slug}`)} className="hover:underline hover:text-blue-600 focus:outline-none">
                        {type.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-neutral-500">{type.slug}</TableCell>
                    <TableCell className="text-neutral-500">{formatDate(type.created_at)}</TableCell>
                    <TableCell className="text-neutral-500">{formatDate(type.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length === 0 && (
              <p className="p-6 text-center text-sm text-neutral-500">No content type matches "{search}".</p>
            )}
            <div className="p-4 border-t border-neutral-100 text-sm text-neutral-500 bg-neutral-50/50">
              {visible.length} of {types.data.length} content types
            </div>
          </>
        )}
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
