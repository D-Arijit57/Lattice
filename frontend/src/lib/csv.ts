import { buildPayload, kindOf } from "@/lib/entry-fields"
import type { VersionSchema } from "@/types"

// The bulk endpoint refuses bigger batches (one request has to finish inside
// the server's timeout), so the UI stops at the same number.
export const MAX_BULK_ROWS = 500

// Splits CSV text into rows of cells. Handles quoted cells (commas, newlines
// and "" escapes inside them), CRLF line endings and a leading BOM. Fully
// blank lines are dropped.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      cell = ""
      rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (quoted) throw new Error("The file has an unclosed quote.")
  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

// One CSV line turned into an entry, plus whatever is wrong with it. `errors`
// is keyed by field name, the same shape the server uses.
export type CsvRow = {
  data: Record<string, unknown>
  errors: Record<string, string[]>
}

export type CsvImport = {
  rows: CsvRow[]
  // Columns in the file that are not fields of the schema; they are ignored.
  unknownColumns: string[]
  // Required fields with no column at all; nothing can be imported then.
  missingColumns: string[]
}

const TRUE_WORDS = ["true", "yes", "y", "1"]
const FALSE_WORDS = ["false", "no", "n", "0", ""]

// Reads CSV text against a version's schema: the header row names the fields,
// every other row becomes an entry. Mirrors what the form does (buildPayload)
// and checks the same things the server will, so most mistakes show up
// before anything is sent.
export function readEntries(text: string, schema: VersionSchema): CsvImport {
  const [header = [], ...body] = parseCsv(text)
  const columns = header.map((h) => h.trim())
  const names = Object.keys(schema.properties)

  const unknownColumns = columns.filter((c) => c !== "" && !names.includes(c))
  const missingColumns = schema.required.filter((n) => !columns.includes(n))

  const rows = body.map((cells): CsvRow => {
    const values: Record<string, string | boolean> = {}
    const errors: Record<string, string[]> = {}

    for (const name of names) {
      const index = columns.indexOf(name)
      // A field with no column is covered by missingColumns / left out.
      if (index === -1) continue
      const raw = (cells[index] ?? "").trim()
      const kind = kindOf(schema.properties[name])
      const fail = (message: string) => (errors[name] = [message])

      if (kind === "boolean") {
        if (TRUE_WORDS.includes(raw.toLowerCase())) values[name] = true
        else if (FALSE_WORDS.includes(raw.toLowerCase())) values[name] = false
        else fail("Must be true or false.")
      } else if (raw === "") {
        if (schema.required.includes(name)) fail("This field is required.")
      } else if (kind === "number" && Number.isNaN(Number(raw))) {
        fail("Must be a number.")
      } else if (kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        fail("Must be a date like 2026-11-04.")
      } else if (kind === "datetime" && Number.isNaN(new Date(raw).getTime())) {
        // No offset (2026-11-04T14:30) means the importer's local time, the
        // same as picking it in the entry form; an offset or "Z" is kept as given.
        fail("Must be a date and time like 2026-11-04T14:30.")
      } else {
        values[name] = raw
      }
    }

    return { data: buildPayload(schema.properties, values), errors }
  })

  return { rows, unknownColumns, missingColumns }
}

// A header-only CSV the user can fill in and import back.
export function templateCsv(schema: VersionSchema): string {
  return Object.keys(schema.properties).join(",") + "\n"
}
