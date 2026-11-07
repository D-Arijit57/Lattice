import type { SchemaProperty } from "@/types"
import { formatDateTime } from "@/lib/utils"

// A version's schema says what each property is: {"type": "string", "format": "date"}
// is a date, {"type": "number"} a number, and so on. UI code asks "what kind
// of input is this?" through kindOf() instead of repeating that logic.
export type FieldKind = "string" | "number" | "boolean" | "date" | "datetime"

export function kindOf(property: SchemaProperty): FieldKind {
  if (property.type === "string" && property.format === "date") return "date"
  if (property.type === "string" && property.format === "date-time") return "datetime"
  return property.type
}

const pad = (n: number) => String(n).padStart(2, "0")

// The API stores a datetime as an ISO string with a UTC offset, e.g.
// "2026-11-07T09:00:00.000Z". The browser's <input type="datetime-local">
// works in the viewer's own time zone and wants "2026-11-07T14:30". These two
// functions convert between the two, so people pick a time in their own zone
// and the API still receives an unambiguous moment.
export function isoToLocalInput(iso: unknown): string {
  const date = new Date(String(iso))
  if (Number.isNaN(date.getTime())) return ""
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function localInputToIso(value: string): string {
  const date = new Date(value)
  // An unparseable value is passed on as it is: the server rejects it with a
  // readable message, which beats throwing inside a render.
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

// Turns what the user typed into the object the API expects, following the
// schema: numbers become numbers, datetimes become ISO strings, empty
// optional inputs are left out.
//
// `original` is the entry's stored data when editing. A datetime input only
// has minute precision, so a value the user did not change is sent back
// exactly as it was stored instead of being rounded to the minute.
export function buildPayload(
  properties: Record<string, SchemaProperty>,
  values: Record<string, string | boolean>,
  original?: Record<string, unknown>,
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
    } else if (kind === "datetime") {
      const stored = original?.[name]
      const unchanged = typeof stored === "string" && isoToLocalInput(stored) === value
      data[name] = unchanged ? stored : localInputToIso(String(value))
    } else {
      data[name] = value
    }
  }
  return data
}

// How a stored value is shown in a table cell. A missing value (an optional
// field the entry left out) is shown as a dash.
export function displayValue(value: unknown, kind?: FieldKind): string {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (kind === "datetime" && typeof value === "string") {
    return Number.isNaN(new Date(value).getTime()) ? value : formatDateTime(value)
  }
  return String(value)
}
