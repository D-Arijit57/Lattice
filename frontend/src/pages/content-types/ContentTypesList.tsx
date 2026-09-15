import { Plus, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { mockContentTypes } from "@/lib/mock-data"
import { Link } from "react-router-dom"

export function ContentTypesList() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center text-sm text-neutral-500 mb-4">
        <span>Overview</span>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Content Types</h2>
          <p className="text-neutral-500 mt-1">Define and manage the structured data models used by your workspace.</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New Content Type</Button>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-4 bg-neutral-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <Input type="text" placeholder="Search content types..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="shrink-0 bg-white"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockContentTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="text-center">
                   <div className={`w-8 h-8 rounded mx-auto flex items-center justify-center bg-blue-50 text-blue-600`}>
                      <DatabaseIcon id={type.id} />
                   </div>
                </TableCell>
                <TableCell className="font-medium text-neutral-900">
                  <Link to={`/content-types/${type.slug}`} className="hover:underline hover:text-blue-600 focus:outline-none">
                    {type.name}
                  </Link>
                </TableCell>
                <TableCell className="text-neutral-500 max-w-xs truncate">{type.description}</TableCell>
                <TableCell className="text-right font-medium">{type.entriesCount.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${type.versionStatus === 'Current' ? 'bg-green-500' : 'bg-neutral-300'}`}></div>
                    <span className="font-mono text-sm">{type.currentVersion}</span>
                  </div>
                </TableCell>
                <TableCell className="text-neutral-500">{type.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-sm text-neutral-500 bg-neutral-50/50">
          <div>1-{mockContentTypes.length} of {mockContentTypes.length}</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>&lt;</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-blue-50 text-blue-700 border-blue-200">1</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>&gt;</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DatabaseIcon({ id }: { id: string }) {
  if (id === 'ct_products') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (id === 'ct_categories') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
  if (id === 'ct_orders') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
  if (id === 'ct_customers') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
}
