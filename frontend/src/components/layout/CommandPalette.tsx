import * as React from "react"
import { Search, Database, FileText, Settings, Plus, UserPlus } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Static for now - these items don't navigate or run an action yet (that's
// a separate, bigger feature). This list only exists so typing has
// something to filter and Tab has something to complete against.
type CommandItem = {
  label: string
  group: "Navigation" | "Actions"
  icon: React.ComponentType<{ className?: string }>
}

const COMMANDS: CommandItem[] = [
  { label: "Content Types", group: "Navigation", icon: Database },
  { label: "Entries", group: "Navigation", icon: FileText },
  { label: "Settings", group: "Navigation", icon: Settings },
  { label: "Create Content Type", group: "Actions", icon: Plus },
  { label: "Create Entry", group: "Actions", icon: Plus },
  { label: "Invite Member", group: "Actions", icon: UserPlus },
]

export function CommandPalette({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("")
    setOpen(next)
  }

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed === ""
    ? COMMANDS
    : COMMANDS.filter((item) => item.label.toLowerCase().includes(trimmed))

  // The item Tab completes to - always the first visible match, same as
  // what shows first on screen, so what you see is what Tab fills in.
  const topMatch = filtered[0]

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Tab" || !topMatch) return
    // Nothing to complete if the query is empty or already matches in full -
    // let Tab do its normal thing (move focus) in that case.
    if (trimmed === "" || topMatch.label.toLowerCase() === trimmed) return
    e.preventDefault()
    setQuery(topMatch.label)
  }

  const groups: CommandItem["group"][] = ["Navigation", "Actions"]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 border-neutral-200 overflow-hidden sm:max-w-[500px] shadow-2xl">
        <div className="flex items-center border-b border-neutral-100 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-neutral-500" />
          <Input
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-neutral-500"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-500">No matching commands.</p>
          )}
          {groups.map((group) => {
            const items = filtered.filter((item) => item.group === group)
            if (items.length === 0) return null
            return (
              <div key={group}>
                <div className="mb-2 px-2 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider first:mt-0 mt-4">
                  {group}
                </div>
                {items.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900",
                      item === topMatch && "bg-neutral-100",
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4 text-neutral-500" />
                    <span>{item.label}</span>
                    {item === topMatch && (
                      <span className="ml-auto text-xs text-neutral-400 font-mono">Tab</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
