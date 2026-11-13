import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PublishDiff } from "@/components/PublishDiff"
import { textareaClass } from "@/components/forms/RequestPublishButton"
import { useAuth } from "@/lib/auth-context"
import { errorMessage, publishRequests } from "@/lib/api"
import { useCan } from "@/lib/org-context"
import { useApi } from "@/lib/use-api"
import { useOrgId } from "@/lib/use-org"
import { formatDate, formatDateTime } from "@/lib/utils"
import type { PublishRequest, PublishRequestStatus } from "@/types"
import { useContentType } from "./ContentTypeWorkspace"

const STATUS_BADGE: Record<PublishRequestStatus, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
}

const STATUS_LABEL: Record<PublishRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

// Guard first (viewers have no business here and the API would refuse them),
// then the real page.
export function PublishRequests() {
  const can = useCan()
  if (!can("requestPublish")) {
    return (
      <EmptyState
        title="Publish requests are for editors and above"
        description="Viewers can read content but not follow what is being published."
      />
    )
  }
  return <PublishRequestsContent />
}

function PublishRequestsContent() {
  const contentType = useContentType()
  const orgId = useOrgId()
  const can = useCan()
  const list = useApi(() => publishRequests.list(orgId, contentType.id), [orgId, contentType.id])
  // The request shown in the dialog; null = closed.
  const [openId, setOpenId] = useState<number | null>(null)

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h3 className="text-xl font-bold tracking-tight text-neutral-900">Publish requests</h3>
        <p className="text-sm text-neutral-500 mt-1">
          {can("reviewPublish")
            ? "Editors ask for their draft fields to be published. Review the changes, then approve or reject."
            : "Ask an admin to publish your draft fields from the Versions tab, and follow the request here."}
        </p>
      </div>

      {list.loading && !list.data && <LoadingState />}
      {list.error != null && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <EmptyState
            title="No publish requests yet"
            description="They show up here, with the decision, once someone asks."
          />
        </div>
      )}
      {list.data && list.data.length > 0 && (
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Badge variant={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</Badge></TableCell>
                  <TableCell className="text-neutral-900">{item.requested_by_name ?? "Former member"}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-neutral-600">{item.note || "-"}</TableCell>
                  <TableCell className="text-neutral-500">{formatDate(item.created_at)}</TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    {item.status === "approved" && `Published v${item.version_number}`}
                    {item.status === "rejected" && "Not published"}
                    {item.status === "cancelled" && "Withdrawn"}
                    {item.status === "pending" && "Waiting for review"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={item.status === "pending" && can("reviewPublish") ? "default" : "outline"}
                      size="sm"
                      className={item.status === "pending" && can("reviewPublish") ? "" : "bg-white"}
                      onClick={() => setOpenId(item.id)}
                    >
                      {item.status === "pending" && can("reviewPublish") ? "Review" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent>
          {/* Keyed by id so the note box starts empty for every request. */}
          {openId !== null && (
            <ReviewBody
              key={openId}
              orgId={orgId}
              contentTypeId={contentType.id}
              requestId={openId}
              onClose={() => setOpenId(null)}
              onChanged={list.reload}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type Action = "approve" | "reject" | "cancel"

function ReviewBody({
  orgId,
  contentTypeId,
  requestId,
  onClose,
  onChanged,
}: {
  orgId: number
  contentTypeId: number
  requestId: number
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const can = useCan()
  // Loaded when the dialog opens: the detail view is the one that carries the
  // diff, computed from the draft fields right now.
  const detail = useApi(() => publishRequests.get(orgId, contentTypeId, requestId), [requestId])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: Action) {
    setBusy(action)
    setError(null)
    try {
      const text = note.trim()
      if (action === "approve") await publishRequests.approve(orgId, contentTypeId, requestId, text)
      if (action === "reject") await publishRequests.reject(orgId, contentTypeId, requestId, text)
      if (action === "cancel") await publishRequests.cancel(orgId, contentTypeId, requestId)
      onChanged()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  if (detail.loading) return <LoadingState />
  if (detail.error != null || !detail.data) return <ErrorState error={detail.error} onRetry={detail.reload} />

  const request: PublishRequest = detail.data
  const pending = request.status === "pending"
  const canReview = pending && can("reviewPublish")
  const canCancel = pending && (request.requested_by === user?.id || can("reviewPublish"))

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          Publish request
          <Badge variant={STATUS_BADGE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
        </DialogTitle>
        <DialogDescription>
          {request.requested_by_name ?? "A former member"} asked on {formatDateTime(request.created_at)}.
        </DialogDescription>
      </DialogHeader>

      {request.note && (
        <blockquote className="border-l-2 border-neutral-300 pl-3 text-sm text-neutral-700">{request.note}</blockquote>
      )}

      {pending && request.diff && (
        <div className="grid gap-2">
          <h4 className="text-sm font-semibold text-neutral-900">What publishing would change</h4>
          <PublishDiff diff={request.diff} />
        </div>
      )}

      {!pending && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {request.status === "approved" && <p>Published as v{request.version_number}.</p>}
          {request.status === "rejected" && <p>Not published.</p>}
          {request.status === "cancelled" && <p>This request was withdrawn.</p>}
          {request.decided_by_name && request.decided_at && (
            <p className="text-neutral-500">
              {request.decided_by_name}, {formatDateTime(request.decided_at)}
            </p>
          )}
          {request.decision_note && <p className="mt-2">{request.decision_note}</p>}
        </div>
      )}

      {canReview && (
        <div className="grid gap-2">
          <label htmlFor="decision-note" className="text-sm font-semibold text-neutral-900">
            Note <span className="font-normal text-neutral-500">(required to reject)</span>
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className={textareaClass}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canCancel && (
          <Button variant="outline" className="mr-auto bg-white" disabled={busy !== null} onClick={() => run("cancel")}>
            {busy === "cancel" ? "Withdrawing..." : "Withdraw"}
          </Button>
        )}
        <Button variant="outline" className="bg-white" disabled={busy !== null} onClick={onClose}>
          Close
        </Button>
        {canReview && (
          <>
            <Button variant="destructive" disabled={busy !== null || note.trim() === ""} onClick={() => run("reject")}>
              {busy === "reject" ? "Rejecting..." : "Reject"}
            </Button>
            <Button disabled={busy !== null} onClick={() => run("approve")}>
              {busy === "approve" ? "Publishing..." : "Approve and publish"}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
