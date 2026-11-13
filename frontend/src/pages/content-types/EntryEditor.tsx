import { useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { Check, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { entries, errorMessage, fieldErrors, versions } from "@/lib/api"
import { buildPayload, isoToLocalInput, kindOf } from "@/lib/entry-fields"
import { useApi } from "@/lib/use-api"
import { useContentTypeFromSlug, useOrgId, useOrgPath } from "@/lib/use-org"
import { useCan } from "@/lib/org-context"
import { formatDateTime } from "@/lib/utils"

// One page, two modes:
//   /entries/new        -> a form built from the newest schema version
//   /entries/:entryId   -> the same form, editable in place, for an existing entry
// An existing entry can be archived (soft delete) and restored; an archived
// one is read-only until restored.
export function EntryEditor() {
  const { entryId } = useParams()
  const isNew = entryId === undefined
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const canEdit = useCan()("editEntries")
  const navigate = useNavigate()
  const location = useLocation()

  const type = useContentTypeFromSlug()
  const contentType = type.contentType

  // These wait for the content type: before it is known the call resolves
  // to null, and once it is known the changed dependency triggers the real call.
  const versionList = useApi(
    async () => (contentType ? versions.list(orgId, contentType.id) : null),
    [orgId, contentType?.id],
  )
  const entry = useApi(
    async () => (contentType && !isNew ? entries.get(orgId, contentType.id, Number(entryId)) : null),
    [orgId, contentType?.id, entryId],
  )

  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)
  // Starts true when this page was opened by saving a new entry (see save()),
  // so the green "Saved" shows on the entry's own page, whether or not React
  // kept this component mounted across the URL change.
  const [saved, setSaved] = useState(
    (location.state as { justCreated?: boolean } | null)?.justCreated === true,
  )
  const [confirmingArchive, setConfirmingArchive] = useState(false)

  const failed = type.error ?? versionList.error ?? entry.error
  if (failed) {
    return <ErrorState error={failed} onRetry={() => { type.reload(); versionList.reload(); entry.reload() }} />
  }
  // The version/entry calls only start once the content type is known, so for
  // a moment they have no data and are not "loading" yet - count that as loading too.
  const waiting =
    type.loading ||
    versionList.loading ||
    entry.loading ||
    (contentType != null && (versionList.data === null || (!isNew && entry.data === null)))
  if (waiting) return <LoadingState />
  if (!contentType) {
    return (
      <EmptyState
        title="Content type not found"
        action={<Button asChild><Link to={orgPath("/content-types")}>Back to content types</Link></Button>}
      />
    )
  }

  const basePath = orgPath(`/content-types/${contentType.slug}`)
  const existing = entry.data
  // New entries follow the newest version; an existing one, the version it was saved under.
  const version = isNew
    ? versionList.data?.[0]
    : versionList.data?.find((v) => v.id === existing?.content_type_version_id)

  if (isNew && !canEdit) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <EmptyState
          title="You can't create entries"
          description="Viewers can read entries but not change them. Ask an editor, admin or owner."
          action={<Button asChild><Link to={`${basePath}/entries`}>Back to entries</Link></Button>}
        />
      </div>
    )
  }

  if (isNew && !version) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <EmptyState
          title="Publish a schema version first"
          description="Entries are validated against a published version, and this content type has none."
          action={<Button asChild><Link to={`${basePath}/versions`}>Go to versions</Link></Button>}
        />
      </div>
    )
  }

  const properties = version?.schema.properties ?? {}
  const requiredNames = version?.schema.required ?? []
  const archived = existing?.archived_at != null
  // What the inputs show: the stored data (as text) with the user's edits on top.
  const stored: Record<string, string | boolean> = {}
  for (const [name, property] of Object.entries(properties)) {
    const raw = existing?.data[name]
    const kind = kindOf(property)
    stored[name] =
      kind === "boolean" ? raw === true
      : raw == null ? ""
      // the datetime picker wants the viewer's local time, not the stored UTC string
      : kind === "datetime" ? isoToLocalInput(raw)
      : String(raw)
  }
  const current = isNew ? values : { ...stored, ...values }
  const payload = buildPayload(properties, current, existing?.data)
  const errors = fieldErrors(saveError)
  const generalErrors = errors.non_field_errors ?? []
  // Something failed but not per field (e.g. an unexpected server error).
  const showGeneralError = saveError != null && Object.keys(errors).length === 0

  async function save() {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      if (isNew) {
        const created = await entries.create(orgId, contentType!.id, payload)
        // /entries/new and /entries/:id are the same page, so React keeps this
        // component (and its state) alive when the URL changes. Reset what
        // belongs to the new-entry form, and say "saved" on the entry's page.
        setValues({})
        setSaved(true)
        navigate(`${basePath}/entries/${created.id}`, { state: { justCreated: true } })
      } else {
        await entries.update(orgId, contentType!.id, existing!.id, payload)
        setValues({})
        entry.reload()
        setSaved(true)
      }
    } catch (err) {
      setSaveError(err)
    } finally {
      // Runs on success and on failure, so the button can never stay stuck on
      // "Saving..." whichever path the code took above.
      setSaving(false)
    }
  }

  async function archiveEntry() {
    // ConfirmDialog shows the error and keeps itself open if this throws.
    await entries.archive(orgId, contentType!.id, existing!.id)
    navigate(`${basePath}/entries`)
  }

  async function restoreEntry() {
    setSaving(true)
    setSaveError(null)
    try {
      await entries.restore(orgId, contentType!.id, existing!.id)
      entry.reload()
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  function valueFor(name: string, isBoolean: boolean): string | boolean {
    const raw = current[name]
    if (isBoolean) return raw === true
    return raw === undefined ? "" : String(raw)
  }

  // Two different reasons the form is not editable: the entry is archived
  // (an editor can restore it), or the viewer simply may not edit.
  const readOnly = (!isNew && archived) || !canEdit
  const canRestore = canEdit && !isNew && archived
  const dirty = Object.keys(values).length > 0

  const json = JSON.stringify(payload, null, 2)

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-2rem)]">
      <div className="flex items-center text-sm text-neutral-500 mb-6">
        <Link to={orgPath("/content-types")} className="hover:text-neutral-900 transition-colors">Content Types</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <Link to={basePath} className="hover:text-neutral-900 transition-colors">{contentType.name}</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <Link to={`${basePath}/entries`} className="hover:text-neutral-900 transition-colors">Entries</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <span className="text-neutral-900 font-mono font-medium">{isNew ? "new" : `#${existing?.number ?? entryId}`}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              {isNew ? "New entry" : `Entry #${existing?.number ?? entryId}`}
            </h2>
            {version && <Badge variant="secondary" className="font-mono">v{version.version_number}</Badge>}
          </div>
          {existing && (
            <p className="text-sm text-neutral-500">
              Created {formatDateTime(existing.created_at)} · Updated {formatDateTime(existing.updated_at)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white" asChild>
            <Link to={`${basePath}/entries`}>{isNew ? "Cancel" : "Back to entries"}</Link>
          </Button>
          {isNew && canEdit && <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save entry"}</Button>}
          {!isNew && !archived && canEdit && (
            <>
              <Button variant="outline" className="bg-white" onClick={() => setConfirmingArchive(true)} disabled={saving}>
                Archive
              </Button>
              {saved && !dirty && !saving ? (
                // Green "all saved" state; it goes back to "Save changes" on the next edit.
                <Button disabled className="bg-green-600 text-white disabled:opacity-100">
                  <Check className="w-4 h-4 mr-2" /> Saved
                </Button>
              ) : (
                <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving..." : "Save changes"}</Button>
              )}
            </>
          )}
          {canRestore && <Button onClick={restoreEntry} disabled={saving}>Restore</Button>}
        </div>
      </div>

      {!isNew && archived && (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This entry is archived: it is hidden from the entries list and the delivery API.
          {canEdit ? " Restore it to edit." : ""}
        </p>
      )}
      {!canEdit && !archived && (
        <p className="mb-6 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          You can view this entry but not change it.
        </p>
      )}
      {saved && !dirty && (
        <p className="mb-6 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="w-4 h-4" /> Saved
        </p>
      )}
      {showGeneralError && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(saveError)}
        </p>
      )}
      {generalErrors.length > 0 && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {generalErrors.join(" ")}
        </p>
      )}

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="mb-8 border-b border-neutral-200 rounded-none bg-transparent h-auto p-0 space-x-6 justify-start w-full">
          <TabsTrigger
            value="form"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3"
          >
            Form
          </TabsTrigger>
          <TabsTrigger
            value="json"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3"
          >
            JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <form
            className="max-w-3xl space-y-8"
            onSubmit={(e) => {
              e.preventDefault()
              if (!readOnly && (isNew || dirty)) save()
            }}
          >
            {Object.entries(properties).map(([name, property]) => {
              const kind = kindOf(property)
              const inputId = `field-${name}`
              const fieldErrorList = errors[name] ?? []
              return (
                <div key={name} className="grid grid-cols-[160px_1fr] gap-6 items-start">
                  <label htmlFor={inputId} className="text-sm font-semibold text-neutral-900 pt-2 flex items-center gap-1 font-mono">
                    {name}
                    {requiredNames.includes(name) && <span className="text-red-500">*</span>}
                  </label>

                  <div>
                    {kind === "boolean" ? (
                      <label className="flex items-center gap-2 pt-2 text-sm">
                        <input
                          id={inputId}
                          type="checkbox"
                          disabled={readOnly}
                          checked={valueFor(name, true) as boolean}
                          onChange={(e) => { setSaved(false); setValues((v) => ({ ...v, [name]: e.target.checked })) }}
                          className="rounded border-neutral-300 text-blue-600 w-4 h-4"
                        />
                        Yes
                      </label>
                    ) : (
                      <Input
                        id={inputId}
                        type={kind === "number" ? "number" : kind === "date" ? "date" : kind === "datetime" ? "datetime-local" : "text"}
                        step={kind === "number" ? "any" : undefined}
                        disabled={readOnly}
                        value={valueFor(name, false) as string}
                        onChange={(e) => { setSaved(false); setValues((v) => ({ ...v, [name]: e.target.value })) }}
                        className={kind === "number" ? "font-mono" : undefined}
                      />
                    )}
                    {fieldErrorList.map((message) => (
                      <p key={message} className="text-sm text-red-600 mt-1">{message}</p>
                    ))}
                  </div>
                </div>
              )
            })}
            {Object.keys(properties).length === 0 && (
              <p className="text-sm text-neutral-500">This version has no fields.</p>
            )}
          </form>
        </TabsContent>

        <TabsContent value="json">
          <div className="bg-neutral-900 rounded-xl overflow-hidden text-neutral-100 font-mono text-sm shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-950 border-b border-neutral-800">
              <span className="text-neutral-400">{isNew ? "payload.json" : "entry.json"}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-neutral-400 hover:text-white hover:bg-neutral-800"
                onClick={() => navigator.clipboard.writeText(json)}
              >
                Copy
              </Button>
            </div>
            <pre className="p-6 overflow-x-auto">
              <code>{json}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        title={`Archive entry #${existing?.number ?? entryId}?`}
        description="It disappears from the entries list and the delivery API. You can restore it from the Archived tab."
        confirmLabel="Archive"
        busyLabel="Archiving..."
        onConfirm={archiveEntry}
      />
    </div>
  )
}
