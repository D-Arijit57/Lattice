import type { FieldShape, SchemaDiff } from "@/types"

// "string · required", "date · optional" ...
function describe(shape: FieldShape): string {
  const kind = shape.format === "date-time" ? "datetime" : (shape.format ?? shape.type)
  return `${kind} · ${shape.required ? "required" : "optional"}`
}

// Shows what publishing would change: fields added, removed and changed
// compared with the newest published version.
export function PublishDiff({ diff }: { diff: SchemaDiff }) {
  const nothing = diff.added.length + diff.removed.length + diff.changed.length === 0
  if (nothing) {
    return <p className="text-sm text-neutral-500">The fields match the latest version: nothing to publish.</p>
  }
  return (
    <ul className="space-y-1.5 text-sm font-mono">
      {diff.added.map((field) => (
        <li key={`add-${field.name}`} className="rounded bg-green-50 px-2 py-1 text-green-800">
          + {field.name} <span className="text-green-700/70">({describe(field)})</span>
        </li>
      ))}
      {diff.changed.map((field) => (
        <li key={`chg-${field.name}`} className="rounded bg-amber-50 px-2 py-1 text-amber-800">
          ~ {field.name}{" "}
          <span className="text-amber-700/80">
            ({describe(field.from)} to {describe(field.to)})
          </span>
        </li>
      ))}
      {diff.removed.map((field) => (
        <li key={`del-${field.name}`} className="rounded bg-red-50 px-2 py-1 text-red-800">
          - {field.name} <span className="text-red-700/70">({describe(field)})</span>
        </li>
      ))}
    </ul>
  )
}
