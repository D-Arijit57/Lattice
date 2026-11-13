import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { errorMessage, publishRequests } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { useOrgId, useOrgPath } from "@/lib/use-org"
import type { ContentType } from "@/types"

export const textareaClass =
  "flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"

// What an editor sees where an admin sees "New version": a button that asks an
// admin to publish the current draft fields. Only one request can be open per
// content type, so while one is pending the button says so and links to it.
export function RequestPublishButton({ contentType }: { contentType: ContentType }) {
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const navigate = useNavigate()
  const requestsPath = orgPath(`/content-types/${contentType.slug}/requests`)

  const pending = useApi(
    () => publishRequests.list(orgId, contentType.id, "pending"),
    [orgId, contentType.id],
  )
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (submitting) return
    if (!next) {
      setNote("")
      setError(null)
    }
    setOpen(next)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await publishRequests.create(orgId, contentType.id, note.trim())
      setSubmitting(false)
      setOpen(false)
      setNote("")
      // The request lives on the Requests tab; take the editor there.
      navigate(requestsPath)
    } catch (err) {
      // e.g. "Nothing to publish: the fields match the latest version."
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const hasPending = (pending.data?.length ?? 0) > 0

  return (
    <>
      {hasPending ? (
        <div className="flex items-center gap-3 text-sm text-neutral-600">
          A publish request is waiting for review.
          <Button asChild variant="outline" size="sm" className="bg-white">
            <Link to={requestsPath}>View request</Link>
          </Button>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={pending.loading}>
          <Send className="w-4 h-4 mr-2" /> Request publish
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a publish</DialogTitle>
            <DialogDescription>
              An admin or owner reviews your draft fields and publishes them as the next version.
              Nothing changes for existing entries until they approve.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="publish-note" className="text-sm font-semibold text-neutral-900">
                Note for the reviewer <span className="font-normal text-neutral-500">(optional)</span>
              </label>
              <textarea
                id="publish-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What changed and why"
                className={textareaClass}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
