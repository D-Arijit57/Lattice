import { useState, type FormEvent } from "react"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiKeys, errorMessage } from "@/lib/api"
import type { APIKeyCreated } from "@/types"

export function NewApiKeyDialog({
  orgId,
  open,
  onOpenChange,
  onCreated,
}: {
  orgId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Once set, the dialog switches from the form to the one-time reveal
  // screen - there is no way back to the form without closing and reopening.
  const [created, setCreated] = useState<APIKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setName("")
    setError(null)
    setSubmitting(false)
    setCreated(null)
    setCopied(false)
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const key = await apiKeys.create(orgId, { name: name.trim() })
      setCreated(key)
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  function handleCopy() {
    if (!created) return
    navigator.clipboard.writeText(created.key)
    setCopied(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>New API key</DialogTitle>
              <DialogDescription>
                Grants read-only access to every content type in this organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="key-name" className="text-sm font-semibold text-neutral-900">
                  Name
                </label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Netflix prod site"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting || name.trim() === ""}>
                {submitting ? "Creating..." : "Create key"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>
                This is the only time the full key is shown. If you lose it, revoke this key and
                create a new one - it can't be recovered.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-[#0D1117] rounded-xl p-4 flex items-center justify-between gap-3">
              <code className="text-sm text-neutral-100 font-mono break-all">{created.key}</code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white/10 text-white hover:bg-white/20 border-none"
                onClick={handleCopy}
              >
                <Copy className="w-3 h-3 mr-2" /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
