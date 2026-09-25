import type { SchemaProperty } from "@/types"

// A version's schema says what each property is: {"type": "string", "format": "date"}
// is a date, {"type": "number"} a number, and so on. UI code asks "what kind
// of input is this?" through kindOf() instead of repeating that logic.
export type FieldKind = "string" | "number" | "boolean" | "date"

export function kindOf(property: SchemaProperty): FieldKind {
  if (property.type === "string" && property.format === "date") return "date"
  return property.type
}

// How a stored value is shown in a table cell. A missing value (an optional
// field the entry left out) is shown as a dash.
export function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}
