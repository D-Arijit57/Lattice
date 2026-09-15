import * as React from "react"
import { NavLink, useLocation, Outlet } from "react-router-dom"
import { LayoutDashboard, Database, FileText, Code2, Activity, Settings, UserCircle, Search, Zap, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

function Sidebar() {
  const location = useLocation()
  
  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r border-neutral-200 bg-white shrink-0">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Loom</h1>
      </div>
      
      <div className="px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-9 px-3">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded text-xs font-semibold">
                  A
                </div>
                Acme Inc.
              </span>
              <span className="text-neutral-400 text-xs">▼</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded text-xs font-semibold mr-2">A</div>
              Acme Inc.
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="w-5 h-5 bg-purple-100 text-purple-700 flex items-center justify-center rounded text-xs font-semibold mr-2">S</div>
              Stark Industries
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Plus className="w-4 h-4 mr-2" /> Create Workspace</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          <NavLink
            to="/"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
        </nav>

        <div className="mt-6 px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Content
        </div>
        <nav className="grid gap-1 px-3">
          <NavLink
            to="/content-types"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive || location.pathname.includes('/content-types') ? "bg-blue-50 text-blue-700" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <Database className="h-4 w-4" />
            Content Types
          </NavLink>
          <NavLink
            to="/entries"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-blue-50 text-blue-700" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <FileText className="h-4 w-4" />
            Entries
          </NavLink>
        </nav>

        <div className="mt-6 px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Develop
        </div>
        <nav className="grid gap-1 px-3">
          <NavLink
            to="/api-docs"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <Code2 className="h-4 w-4" />
            API
          </NavLink>
        </nav>

        <div className="mt-6 px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          System
        </div>
        <nav className="grid gap-1 px-3">
          <NavLink
            to="/activity"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <Activity className="h-4 w-4" />
            Activity
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-neutral-50 text-left">
              <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center font-medium text-neutral-700">
                AD
              </div>
              <div className="flex-1 overflow-hidden text-sm">
                <p className="truncate font-medium text-neutral-900">Arijit Das</p>
                <p className="truncate text-xs text-neutral-500">Free Plan</p>
              </div>
              <span className="text-neutral-400 text-xs">▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
