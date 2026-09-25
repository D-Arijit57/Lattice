import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, organizations } from "@/lib/api"
import type { Organization } from "@/types"

export function CreateOrganizationForm({
  onCreated,
}: {
  onCreated: (organization: Organization) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      onCreated(await organizations.create(name.trim()))
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="org-name" className="text-sm font-semibold text-neutral-900">
          Organization name
        </label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc."
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting || name.trim() === ""}>
        {submitting ? "Creating..." : "Create organization"}
      </Button>
    </form>
  )
}
