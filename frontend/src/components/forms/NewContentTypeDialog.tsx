import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { contentTypes, errorMessage } from "@/lib/api"
import { slugify } from "@/lib/utils"
import type { ContentType } from "@/types"

export function NewContentTypeDialog({
  orgId,
  open,
  onOpenChange,
  onCreated,
}: {
  orgId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (contentType: ContentType) => void
}) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  // Once the user types their own slug, stop overwriting it from the name.
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName("")
    setSlug("")
    setSlugEdited(false)
    setError(null)
    setSubmitting(false)
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await contentTypes.create(orgId, { name: name.trim(), slug })
      reset()
      onCreated(created)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New content type</DialogTitle>
          <DialogDescription>
            A content type describes one kind of content, like Product or Event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="ct-name" className="text-sm font-semibold text-neutral-900">Name</label>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Blog Posts"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="ct-slug" className="text-sm font-semibold text-neutral-900">Slug</label>
            <Input
              id="ct-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugEdited(true)
              }}
              placeholder="blog-posts"
              className="font-mono"
            />
            <p className="text-xs text-neutral-500">
              Used in URLs. Lowercase letters, numbers and hyphens only.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting || name.trim() === "" || slug === ""}>
            {submitting ? "Creating..." : "Create content type"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
