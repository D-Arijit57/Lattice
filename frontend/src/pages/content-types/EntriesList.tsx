import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { cursorFrom, entries, errorMessage, versions } from "@/lib/api"
import { displayValue } from "@/lib/entry-fields"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import { formatDateTime } from "@/lib/utils"
import type { Entry } from "@/types"
import { useContentType } from "./ContentTypeWorkspace"

// How many of the schema's fields get their own column. Entries can have
// more; the rest are on the entry's own page.
const MAX_DATA_COLUMNS = 4

export function EntriesList() {
  const contentType = useContentType()
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const basePath = orgPath(`/content-types/${contentType.slug}`)

  const versionList = useApi(() => versions.list(orgId, contentType.id), [orgId, contentType.id])
  const firstPage = useApi(() => entries.list(orgId, contentType.id), [orgId, contentType.id])

  // The API pages entries with a cursor ("give me what comes after this
  // one"), so the list grows by appending pages: page one comes from
  // useApi, "Load more" fetches the next and adds it below.
  const [moreRows, setMoreRows] = useState<Entry[]>([])
  // undefined = "Load more" not used yet, so the cursor is the first page's `next`.
  const [laterCursor, setLaterCursor] = useState<string | null | undefined>(undefined)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  // Switching to another content type starts the list over.
  useEffect(() => {
    setMoreRows([])
    setLaterCursor(undefined)
  }, [contentType.id])

  const rows = [...(firstPage.data?.results ?? []), ...moreRows]
  const cursor = laterCursor === undefined ? cursorFrom(firstPage.data?.next ?? null) : laterCursor

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await entries.list(orgId, contentType.id, cursor)
      setMoreRows((current) => [...current, ...page.results])
      setLaterCursor(cursorFrom(page.next))
    } catch (err) {
      setMoreError(errorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  if (versionList.loading || firstPage.loading) return <LoadingState />
  const failed = versionList.error ?? firstPage.error
  if (failed) return <ErrorState error={failed} onRetry={() => { versionList.reload(); firstPage.reload() }} />

  // Columns come from the newest version's fields, so each content type
  // shows its own fields instead of one hardcoded set.
  const latest = versionList.data?.[0]
  const columns = latest ? Object.keys(latest.schema.properties).slice(0, MAX_DATA_COLUMNS) : []

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold tracking-tight text-neutral-900">Entries</h3>
          <Badge variant="secondary" className="font-mono bg-neutral-100">
            {rows.length}{cursor ? "+" : ""} {rows.length === 1 && !cursor ? "entry" : "entries"}
          </Badge>
        </div>
        {latest && (
          <Button asChild>
            <Link to={`${basePath}/entries/new`}><Plus className="w-4 h-4 mr-2" /> New entry</Link>
          </Button>
        )}
      </div>

      {!latest ? (
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl">
          <EmptyState
            title="No schema version published yet"
            description="Entries are validated against a published version. Add fields, then publish one."
            action={<Button asChild variant="outline"><Link to={`${basePath}/versions`}>Go to versions</Link></Button>}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl">
          <EmptyState
            title="No entries yet"
            description="Create the first one."
            action={<Button asChild><Link to={`${basePath}/entries/new`}>New entry</Link></Button>}
          />
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                {columns.map((name) => (
                  <TableHead key={name} className="font-mono">{name}</TableHead>
                ))}
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-sm">
                    <Link to={`${basePath}/entries/${entry.id}`} className="text-blue-600 hover:underline">
                      #{entry.id}
                    </Link>
                  </TableCell>
                  {columns.map((name) => (
                    <TableCell key={name} className="text-neutral-700 max-w-[14rem] truncate">
                      {displayValue(entry.data[name])}
                    </TableCell>
                  ))}
                  <TableCell className="font-mono text-sm text-neutral-500">v{entry.version_number}</TableCell>
                  <TableCell className="text-neutral-500 text-sm">{formatDateTime(entry.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(cursor || moreError) && (
            <div className="p-4 border-t border-neutral-100 flex items-center justify-center gap-4 bg-neutral-50/50">
              {moreError && <span className="text-sm text-red-600">{moreError}</span>}
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
