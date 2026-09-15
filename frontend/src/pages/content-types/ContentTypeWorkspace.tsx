import { Link, NavLink, Outlet, useParams, useLocation } from "react-router-dom"
import { MoreHorizontal, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockContentTypes } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function ContentTypeWorkspace() {
  const { slug } = useParams()
  const location = useLocation()
  const contentType = mockContentTypes.find(ct => ct.slug === slug) || mockContentTypes[0]

  const basePath = `/content-types/${contentType.slug}`

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-2rem)]">
      <div className="flex items-center text-sm text-neutral-500 mb-6">
        <Link to="/content-types" className="hover:text-neutral-900 transition-colors">Content Types</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <span className="text-neutral-900 font-medium">{contentType.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
             <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{contentType.name}</h2>
              <Badge variant="secondary" className="font-mono">{contentType.currentVersion}</Badge>
              <Badge variant="success" className="bg-green-100 text-green-700 hover:bg-green-100">{contentType.versionStatus}</Badge>
            </div>
            <p className="text-neutral-500 text-lg">{contentType.description}</p>
          </div>
        </div>
        
        <Button variant="outline" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      <div className="border-b border-neutral-200 mb-6">
        <nav className="flex space-x-6">
          <NavLink 
            to={basePath} 
            end
            className={({ isActive }) => cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors",
              isActive ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
            )}
          >
            Overview
          </NavLink>
          <NavLink 
            to={`${basePath}/schema`} 
            className={({ isActive }) => cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors",
              isActive ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
            )}
          >
            Schema
          </NavLink>
          <NavLink 
            to={`${basePath}/versions`} 
            className={({ isActive }) => cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors",
              isActive ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
            )}
          >
            Versions
          </NavLink>
          <NavLink 
            to={`${basePath}/entries`} 
            className={({ isActive }) => cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors",
              isActive || location.pathname.includes('/entries/') ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
            )}
          >
            Entries
          </NavLink>
          <NavLink 
            to={`${basePath}/api`} 
            className={({ isActive }) => cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors",
              isActive ? "border-blue-600 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
            )}
          >
            API
          </NavLink>
        </nav>
      </div>

      <div className="flex-1">
        <Outlet context={{ contentType }} />
      </div>
    </div>
  )
}
