import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NewApiKeyDialog } from "@/components/forms/NewApiKeyDialog"
import { apiKeys, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId } from "@/lib/use-org"
import { formatDate } from "@/lib/utils"
import type { APIKey } from "@/types"

export function ApiKeysPage() {
  const orgId = useOrgId()
  const [newOpen, setNewOpen] = useState(false)
  // The key currently in the revoke-confirm dialog; null means it's closed.
  const [revoking, setRevoking] = useState<APIKey | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [revokeSubmitting, setRevokeSubmitting] = useState(false)

  const keys = useApi(() => apiKeys.list(orgId), [orgId])

  function closeRevoke() {
    setRevoking(null)
    setRevokeError(null)
  }

  async function handleRevoke() {
    if (!revoking) return
    setRevokeSubmitting(true)
    setRevokeError(null)
    try {
      await apiKeys.revoke(orgId, revoking.id)
      setRevoking(null)
      keys.reload()
    } catch (err) {
      setRevokeError(errorMessage(err))
    } finally {
      setRevokeSubmitting(false)
    }
  }

  // Active keys first, so the ones someone might actually act on aren't
  // buried under a long revoked history.
  const active = (keys.data ?? []).filter((key) => !key.revoked_at)
  const revoked = (keys.data ?? []).filter((key) => key.revoked_at)
  const ordered = [...active, ...revoked]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">API Keys</h2>
          <p className="text-neutral-500 mt-1">
            Let your own app read this organization's content over the API, without a person
            logging in.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New key
        </Button>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        {keys.loading && <LoadingState />}
        {keys.error != null && <ErrorState error={keys.error} onRetry={keys.reload} />}
        {keys.data && keys.data.length === 0 && (
          <EmptyState
            title="No API keys yet"
            description="Create one to let an external app read this organization's content."
            action={<Button onClick={() => setNewOpen(true)}>New key</Button>}
          />
        )}
        {keys.data && keys.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-neutral-900">{key.name}</TableCell>
                  <TableCell>
                    {key.revoked_at ? (
                      <Badge variant="secondary">Revoked {formatDate(key.revoked_at)}</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-neutral-500">{formatDate(key.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {!key.revoked_at && (
                      <Button variant="destructive" size="sm" onClick={() => setRevoking(key)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <NewApiKeyDialog orgId={orgId} open={newOpen} onOpenChange={setNewOpen} onCreated={keys.reload} />

      <Dialog open={revoking !== null} onOpenChange={(next) => !next && closeRevoke()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke "{revoking?.name}"?</DialogTitle>
            <DialogDescription>
              Any app using this key loses access immediately. This can't be undone - a new key
              would need to be issued and redistributed.
            </DialogDescription>
          </DialogHeader>
          {revokeError && <p className="text-sm text-red-600">{revokeError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeRevoke} disabled={revokeSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeSubmitting}>
              {revokeSubmitting ? "Revoking..." : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
