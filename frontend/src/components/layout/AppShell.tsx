import { useEffect, useState } from "react"
import { Navigate, NavLink, Outlet, useNavigate, useParams } from "react-router-dom"
import { LayoutDashboard, Database, Search, Plus, Check, KeyRound, Trash2, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/lib/auth-context"
import { OrgProvider } from "@/lib/org-context"
import { roleCan } from "@/lib/roles"
import { RoleBadge } from "@/components/RoleBadge"
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  // The sidebar is drawn by AppShell itself, above the provider, so it reads
  // the role straight from the organization it was given.
  const can = (permission: Parameters<typeof roleCan>[1]) => roleCan(current.my_role, permission)
  const base = `/orgs/${current.id}`

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r border-neutral-200 bg-white shrink-0">
      <div className="p-4 flex items-center justify-between">
        <h1 className="font-logo text-2xl text-neutral-900 leading-none">Lattice</h1>
        <NotificationBell />
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
                <RoleBadge role={organization.my_role} className="ml-2 px-2 py-0 text-[10px]" />
                {organization.id === current.id && <Check className="w-4 h-4 text-neutral-500 ml-2" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create organization
            </DropdownMenuItem>
            {can("deleteOrganization") && (
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600 focus:text-red-700">
                <Trash2 className="w-4 h-4 mr-2" /> Delete "{current.name}"
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete organization "${current.name}"?`}
          description="All of its content types, entries and API keys stop working and disappear for every member. The data itself is kept, not erased."
          onConfirm={async () => {
            await organizations.archive(current.id)
            // "/" opens the next organization, or asks for a first one.
            navigate("/", { replace: true })
          }}
        />

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

        {/* Only draw the heading when there is at least one link under it. */}
        {(can("manageMembers") || can("manageApiKeys")) && (
          <div className="mt-6 px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Settings
          </div>
        )}
        <nav className="grid gap-1 px-3">
          {can("manageMembers") && (
            <NavLink to={`${base}/members`} className={({ isActive }) => navLinkClass(isActive)}>
              <Users className="h-4 w-4" />
              Members
            </NavLink>
          )}
          {can("manageApiKeys") && (
            <NavLink to={`${base}/api-keys`} className={({ isActive }) => navLinkClass(isActive)}>
              <KeyRound className="h-4 w-4" />
              API Keys
            </NavLink>
          )}
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
                <RoleBadge role={current.my_role} className="mt-1 px-2 py-0 text-[10px]" />
              </div>
              <span className="text-neutral-400 text-xs">▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/account")}>Account and invitations</DropdownMenuItem>
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
  // The organization in the URL may simply be newer than the list we loaded
  // (just created, or just joined). Before deciding it is not theirs, the list
  // is read once more for that organization.
  const [rechecked, setRechecked] = useState<string | null>(null)

  const current = orgs.data?.find((organization) => String(organization.id) === orgId)
  const missing = !orgs.loading && orgs.error == null && orgs.data != null && !current

  useEffect(() => {
    if (missing && rechecked !== orgId) {
      setRechecked(orgId ?? null)
      orgs.reload()
    }
    // orgs.reload is rebuilt every render; the two values below are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, orgId, rechecked])

  if (orgs.loading) return <LoadingState />
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />
  if (!current) {
    // About to re-read the list: show loading, not a wrong answer.
    if (rechecked !== orgId) return <LoadingState />
    // Still not in the list: this is not their organization. "/" sends them
    // somewhere useful instead of a dead end: their first organization if they
    // have one, otherwise the dashboard with their invitations.
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar current={current} all={orgs.data ?? []} onOrganizationCreated={orgs.reload} />
      <main className="flex-1 overflow-y-auto">
        {/* Every page below reads the organization and the caller's role from here. */}
        <OrgProvider organization={current} reload={orgs.reload}>
          <Outlet />
        </OrgProvider>
      </main>
    </div>
  )
}
