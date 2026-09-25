import { Link, NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { useContentTypeFromSlug, useOrgPath } from "@/lib/use-org"
import { cn } from "@/lib/utils"
import type { ContentType } from "@/types"

// What this page passes down to its tabs (Schema, Versions, Entries, ...).
export type ContentTypeContext = { contentType: ContentType }

// Tabs call this instead of touching react-router's outlet context directly.
export function useContentType() {
  return useOutletContext<ContentTypeContext>().contentType
}

const tabClass = (active: boolean) =>
  cn(
    "pb-3 text-sm font-medium border-b-2 transition-colors",
    active ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
  )

export function ContentTypeWorkspace() {
  const location = useLocation()
  const orgPath = useOrgPath()
  const { contentType, loading, error, reload } = useContentTypeFromSlug()

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!contentType) {
    // A wrong or stale URL must say so, not quietly show some other type.
    return (
      <EmptyState
        title="Content type not found"
        description="It may have been mistyped in the address bar."
        action={<Button asChild><Link to={orgPath("/content-types")}>Back to content types</Link></Button>}
      />
    )
  }

  const basePath = orgPath(`/content-types/${contentType.slug}`)

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-2rem)]">
      <div className="flex items-center text-sm text-neutral-500 mb-6">
        <Link to={orgPath("/content-types")} className="hover:text-neutral-900 transition-colors">Content Types</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <span className="text-neutral-900 font-medium">{contentType.name}</span>
      </div>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{contentType.name}</h2>
            <Badge variant="secondary" className="font-mono">{contentType.slug}</Badge>
          </div>
        </div>
      </div>

      <div className="border-b border-neutral-200 mb-6">
        <nav className="flex space-x-6">
          <NavLink to={basePath} end className={({ isActive }) => tabClass(isActive)}>
            Overview
          </NavLink>
          <NavLink to={`${basePath}/schema`} className={({ isActive }) => tabClass(isActive)}>
            Schema
          </NavLink>
          <NavLink to={`${basePath}/versions`} className={({ isActive }) => tabClass(isActive)}>
            Versions
          </NavLink>
          <NavLink
            to={`${basePath}/entries`}
            className={({ isActive }) => tabClass(isActive || location.pathname.includes('/entries/'))}
          >
            Entries
          </NavLink>
          <NavLink to={`${basePath}/api`} className={({ isActive }) => tabClass(isActive)}>
            API
          </NavLink>
        </nav>
      </div>

      <div className="flex-1">
        <Outlet context={{ contentType } satisfies ContentTypeContext} />
      </div>
    </div>
  )
}
