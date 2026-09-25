import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { entries, errorMessage, fieldErrors, versions } from "@/lib/api"
import { kindOf } from "@/lib/entry-fields"
import { useApi } from "@/lib/use-api"
import { useContentTypeFromSlug, useOrgId, useOrgPath } from "@/lib/use-org"
import { formatDateTime } from "@/lib/utils"
import type { SchemaProperty } from "@/types"

// Turns what the user typed into the object the API expects, following the
// schema: numbers become numbers, empty optional inputs are left out.
function buildPayload(
  properties: Record<string, SchemaProperty>,
  values: Record<string, string | boolean>,
) {
  const data: Record<string, unknown> = {}
  for (const [name, property] of Object.entries(properties)) {
    const value = values[name]
    const kind = kindOf(property)
    if (kind === "boolean") {
      data[name] = value === true
    } else if (value === undefined || value === "") {
      continue
    } else if (kind === "number") {
      data[name] = Number(value)
    } else {
      data[name] = value
    }
  }
  return data
}

// One page, two modes:
//   /entries/new        -> a form built from the newest schema version
//   /entries/:entryId   -> the same form, read-only, for an existing entry
// (The API has no update or delete, so an existing entry is view-only.)
export function EntryEditor() {
  const { entryId } = useParams()
  const isNew = entryId === undefined
  const orgId = useOrgId()
  const orgPath = useOrgPath()
  const navigate = useNavigate()

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
  const payload = isNew ? buildPayload(properties, values) : (existing?.data ?? {})
  const errors = fieldErrors(saveError)
  const generalErrors = errors.non_field_errors ?? []
  // Something failed but not per field (e.g. an unexpected server error).
  const showGeneralError = saveError != null && Object.keys(errors).length === 0

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const created = await entries.create(orgId, contentType!.id, payload)
      navigate(`${basePath}/entries/${created.id}`)
    } catch (err) {
      setSaveError(err)
      setSaving(false)
    }
  }

  function valueFor(name: string, isBoolean: boolean): string | boolean {
    const raw = isNew ? values[name] : existing?.data[name]
    if (isBoolean) return raw === true
    return raw === undefined || raw === null ? "" : String(raw)
  }

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
        <span className="text-neutral-900 font-mono font-medium">{isNew ? "new" : `#${entryId}`}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              {isNew ? "New entry" : `Entry #${entryId}`}
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
          {isNew && <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save entry"}</Button>}
        </div>
      </div>

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
              if (isNew) save()
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
                          disabled={!isNew}
                          checked={valueFor(name, true) as boolean}
                          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.checked }))}
                          className="rounded border-neutral-300 text-blue-600 w-4 h-4"
                        />
                        Yes
                      </label>
                    ) : (
                      <Input
                        id={inputId}
                        type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
                        step={kind === "number" ? "any" : undefined}
                        disabled={!isNew}
                        value={valueFor(name, false) as string}
                        onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
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
    </div>
  )
}
