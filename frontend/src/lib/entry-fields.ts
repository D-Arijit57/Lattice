import type { SchemaProperty } from "@/types"

// A version's schema says what each property is: {"type": "string", "format": "date"}
// is a date, {"type": "number"} a number, and so on. UI code asks "what kind
// of input is this?" through kindOf() instead of repeating that logic.
export type FieldKind = "string" | "number" | "boolean" | "date"

export function kindOf(property: SchemaProperty): FieldKind {
  if (property.type === "string" && property.format === "date") return "date"
  return property.type
}

// Turns what the user typed into the object the API expects, following the
// schema: numbers become numbers, empty optional inputs are left out.
export function buildPayload(
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

// How a stored value is shown in a table cell. A missing value (an optional
// field the entry left out) is shown as a dash.
export function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}
