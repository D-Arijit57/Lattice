import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api"

// A "Are you sure?" popup for destructive actions.
//
//   <ConfirmDialog
//     open={deleting !== null}
//     onOpenChange={(open) => !open && setDeleting(null)}
//     title={`Delete "${deleting?.name}"?`}
//     description="..."
//     confirmLabel="Delete"
//     onConfirm={() => contentTypes.archive(orgId, deleting.id)}
//   />
//
// onConfirm does the work and returns a promise. While it runs the buttons
// are disabled; if it throws, the message is shown in the dialog and the
// dialog stays open so the person can retry or cancel. When it succeeds the
// dialog closes itself.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  busyLabel = "Deleting...",
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  busyLabel?: string
  onConfirm: () => Promise<unknown>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    // Don't let the dialog be dismissed halfway through the request.
    if (submitting) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      setSubmitting(false)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
