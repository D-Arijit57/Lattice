import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { entries, errorMessage, rowErrors } from "@/lib/api"
import { MAX_BULK_ROWS, readEntries, templateCsv, type CsvImport } from "@/lib/csv"
import { displayValue } from "@/lib/entry-fields"
import type { BulkEntryError, VersionSchema } from "@/types"

// The preview shows this many leading columns; the rest are still imported.
const PREVIEW_COLUMNS = 4

function downloadTemplate(schema: VersionSchema, filename: string) {
  const url = URL.createObjectURL(new Blob([templateCsv(schema)], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ImportEntriesDialog({
  orgId,
  contentTypeId,
  contentTypeSlug,
  schema,
  open,
  onOpenChange,
  onImported,
}: {
  orgId: number
  contentTypeId: number
  contentTypeSlug: string
  schema: VersionSchema
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (count: number) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<CsvImport | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Rows the server rejected, by 0-based row index.
  const [serverErrors, setServerErrors] = useState<Map<number, BulkEntryError["data"]>>(new Map())

  const columns = useMemo(() => Object.keys(schema.properties).slice(0, PREVIEW_COLUMNS), [schema])

  function reset() {
    setFileName(null)
    setParsed(null)
    setReadError(null)
    setSubmitting(false)
    setSubmitError(null)
    setServerErrors(new Map())
    if (fileInput.current) fileInput.current.value = ""
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setSubmitError(null)
    setServerErrors(new Map())
    setFileName(file.name)
    try {
      setParsed(readEntries(await file.text(), schema))
      setReadError(null)
    } catch (err) {
      setParsed(null)
      setReadError(errorMessage(err))
    }
  }

  const rows = parsed?.rows ?? []
  const clientBadRows = rows.filter((r) => Object.keys(r.errors).length > 0).length
  const tooMany = rows.length > MAX_BULK_ROWS
  const blocked =
    !parsed ||
    rows.length === 0 ||
    tooMany ||
    clientBadRows > 0 ||
    parsed.missingColumns.length > 0

  async function handleSubmit() {
    if (blocked) return
    setSubmitting(true)
    setSubmitError(null)
    setServerErrors(new Map())
    try {
      const result = await entries.bulkCreate(orgId, contentTypeId, rows.map((r) => r.data))
      reset()
      onImported(result.created)
    } catch (err) {
      const bad = rowErrors(err)
      if (bad.length > 0) {
        setServerErrors(new Map(bad.map((e) => [e.row, e.data])))
        setSubmitError(`The server rejected ${bad.length} ${bad.length === 1 ? "row" : "rows"}. Nothing was imported.`)
      } else {
        setSubmitError(errorMessage(err))
      }
      setSubmitting(false)
    }
  }

  // What to show under a row: its own CSV problems, else the server's.
  function problemsFor(index: number): string[] {
    const own = rows[index]?.errors ?? {}
    const source = Object.keys(own).length > 0 ? own : (serverErrors.get(index) ?? {})
    return Object.entries(source).flatMap(([field, messages]) =>
      messages.map((m) => (field === "non_field_errors" ? m : `${field}: ${m}`)),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import entries from CSV</DialogTitle>
          <DialogDescription>
            The first row names the fields. Up to {MAX_BULK_ROWS} rows per import, and either every
            row is saved or none are.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> {fileName ? "Choose another file" : "Choose CSV file"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => downloadTemplate(schema, `${contentTypeSlug}-template.csv`)}
          >
            <Download className="w-4 h-4 mr-2" /> Download template
          </Button>
          {fileName && <span className="text-sm text-neutral-500 font-mono">{fileName}</span>}
        </div>

        {readError && <p className="text-sm text-red-600">{readError}</p>}

        {parsed && (
          <div className="grid gap-3">
            {parsed.missingColumns.length > 0 && (
              <p className="text-sm text-red-600">
                Missing required {parsed.missingColumns.length === 1 ? "column" : "columns"}:{" "}
                <span className="font-mono">{parsed.missingColumns.join(", ")}</span>
              </p>
            )}
            {parsed.unknownColumns.length > 0 && (
              <p className="text-sm text-amber-700">
                Ignoring {parsed.unknownColumns.length === 1 ? "column" : "columns"} that
                {parsed.unknownColumns.length === 1 ? " isn't" : " aren't"} in the schema:{" "}
                <span className="font-mono">{parsed.unknownColumns.join(", ")}</span>
              </p>
            )}
            {rows.length === 0 && parsed.missingColumns.length === 0 && (
              <p className="text-sm text-red-600">The file has a header but no rows.</p>
            )}
            {tooMany && (
              <p className="text-sm text-red-600">
                {rows.length} rows is over the limit of {MAX_BULK_ROWS}. Split the file and import it in parts.
              </p>
            )}

            {rows.length > 0 && (
              <>
                <p className="text-sm text-neutral-600">
                  {rows.length} {rows.length === 1 ? "row" : "rows"}
                  {clientBadRows > 0 && (
                    <span className="text-red-600"> · {clientBadRows} with problems</span>
                  )}
                </p>
                <div className="max-h-72 overflow-auto rounded-md border border-neutral-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        {columns.map((name) => (
                          <TableHead key={name} className="font-mono">{name}</TableHead>
                        ))}
                        <TableHead>Problems</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => {
                        const problems = problemsFor(index)
                        return (
                          <TableRow key={index} className={problems.length > 0 ? "bg-red-50" : undefined}>
                            <TableCell className="font-mono text-sm text-neutral-500">{index + 1}</TableCell>
                            {columns.map((name) => (
                              <TableCell key={name} className="max-w-[10rem] truncate">
                                {displayValue(row.data[name])}
                              </TableCell>
                            ))}
                            <TableCell className="text-sm text-red-600">{problems.join(" ")}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <Button onClick={handleSubmit} disabled={blocked || submitting}>
          {submitting
            ? "Importing..."
            : rows.length > 0 && !blocked
              ? `Import ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`
              : "Import"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
