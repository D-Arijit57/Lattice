import * as React from "react"
import { Search, Database, FileText, Settings, Plus, UserPlus } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function CommandPalette({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 border-neutral-200 overflow-hidden sm:max-w-[500px] shadow-2xl">
        <div className="flex items-center border-b border-neutral-100 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-neutral-500" />
          <Input 
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-neutral-500"
            placeholder="Type a command or search..."
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          <div className="mb-2 px-2 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Navigation</div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <Database className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Content Types</span>
          </div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <FileText className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Entries</span>
          </div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <Settings className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Settings</span>
          </div>
          
          <div className="mt-4 mb-2 px-2 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <Plus className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Create Content Type</span>
          </div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <Plus className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Create Entry</span>
          </div>
          <div className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900">
            <UserPlus className="mr-2 h-4 w-4 text-neutral-500" />
            <span>Invite Member</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
