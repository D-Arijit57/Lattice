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
import { errorMessage, fields } from "@/lib/api"
import type { Field, FieldDataType } from "@/types"

const DATA_TYPES: FieldDataType[] = ["string", "number", "boolean", "date"]

export function AddFieldDialog({
  orgId,
  contentTypeId,
  open,
  onOpenChange,
  onCreated,
}: {
  orgId: number
  contentTypeId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (field: Field) => void
}) {
  const [name, setName] = useState("")
  const [dataType, setDataType] = useState<FieldDataType>("string")
  // The API treats a field as required unless told otherwise, so start checked.
  const [required, setRequired] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName("")
    setDataType("string")
    setRequired(true)
    setError(null)
    setSubmitting(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await fields.create(orgId, contentTypeId, {
        name: name.trim(),
        data_type: dataType,
        required,
      })
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
          <DialogTitle>Add field</DialogTitle>
          <DialogDescription>
            New fields apply to entries once you publish a new schema version.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="field-name" className="text-sm font-semibold text-neutral-900">Field name</label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="price"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="field-type" className="text-sm font-semibold text-neutral-900">Type</label>
            <select
              id="field-type"
              value={dataType}
              onChange={(e) => setDataType(e.target.value as FieldDataType)}
              className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              {DATA_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-neutral-300 text-blue-600 w-4 h-4"
            />
            Required field
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting || name.trim() === ""}>
            {submitting ? "Adding..." : "Add field"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
