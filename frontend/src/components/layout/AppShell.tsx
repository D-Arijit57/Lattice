import { useState } from "react"
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom"
import { LayoutDashboard, Database, Search, Plus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/lib/auth-context"
import { organizations } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import type { Organization } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const navLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
  )

function Sidebar({
  current,
  all,
  onOrganizationCreated,
}: {
  current: Organization
  all: Organization[]
  onOrganizationCreated: () => void
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const base = `/orgs/${current.id}`

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r border-neutral-200 bg-white shrink-0">
      <div className="p-4 flex items-center justify-between">
        <h1 className="font-logo text-2xl text-neutral-900 leading-none">Lattice</h1>
      </div>

      <div className="px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-9 px-3">
              <span className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded text-xs font-semibold shrink-0">
                  {current.name[0]?.toUpperCase()}
                </div>
                <span className="truncate">{current.name}</span>
              </span>
              <span className="text-neutral-400 text-xs">▼</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {all.map((organization) => (
              <DropdownMenuItem key={organization.id} onClick={() => navigate(`/orgs/${organization.id}`)}>
                <div className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded text-xs font-semibold mr-2 shrink-0">
                  {organization.name[0]?.toUpperCase()}
                </div>
                <span className="truncate flex-1">{organization.name}</span>
                {organization.id === current.id && <Check className="w-4 h-4 text-neutral-500" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>You will be its first member.</DialogDescription>
            </DialogHeader>
            <CreateOrganizationForm
              onCreated={(organization) => {
                setCreateOpen(false)
                onOrganizationCreated()
                navigate(`/orgs/${organization.id}`)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-4 py-2">
         <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex h-9 w-full items-center rounded-md border border-neutral-200 bg-neutral-50 px-8 text-sm text-neutral-500 shadow-sm hover:bg-neutral-100 transition-colors"
            >
              Search... <span className="absolute right-2 text-[10px] font-medium border border-neutral-200 rounded px-1.5 py-0.5 bg-white text-neutral-500 shadow-sm">⌘K</span>
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-3">
          <NavLink to={base} end className={({ isActive }) => navLinkClass(isActive)}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
        </nav>

        <div className="mt-6 px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Content
        </div>
        <nav className="grid gap-1 px-3">
          {/* No `end`: stays highlighted on every page inside a content type too. */}
          <NavLink to={`${base}/content-types`} className={({ isActive }) => navLinkClass(isActive)}>
            <Database className="h-4 w-4" />
            Content Types
          </NavLink>
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-neutral-50 text-left">
              <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center font-medium text-neutral-700">
                {user ? initials(user.name) : ""}
              </div>
              <div className="flex-1 overflow-hidden text-sm">
                <p className="truncate font-medium text-neutral-900">{user?.name}</p>
                <p className="truncate text-xs text-neutral-500">{user?.email}</p>
              </div>
              <span className="text-neutral-400 text-xs">▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function AppShell() {
  const { orgId } = useParams()
  // Loaded once for the sidebar's organization switcher. It also answers
  // "does the signed-in user belong to the organization in this URL?": the
  // list only ever contains their own organizations.
  const orgs = useApi(() => organizations.list(), [])

  if (orgs.loading) return <LoadingState />
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />

  const current = orgs.data?.find((organization) => String(organization.id) === orgId)
  if (!current) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <EmptyState
          title="Organization not found"
          description="It doesn't exist, or you are not a member of it."
          action={<Button asChild><Link to="/">Go to your organizations</Link></Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar current={current} all={orgs.data ?? []} onOrganizationCreated={orgs.reload} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
