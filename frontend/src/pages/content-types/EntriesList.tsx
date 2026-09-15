import { useOutletContext, Link } from "react-router-dom"
import { Plus, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContentType } from "@/types"
import { mockEntries } from "@/lib/mock-data"

export function EntriesList() {
  const { contentType } = useOutletContext<{ contentType: ContentType }>()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold tracking-tight text-neutral-900">Entries</h3>
          <Badge variant="secondary" className="font-mono bg-neutral-100">{contentType.entriesCount.toLocaleString()} entries</Badge>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New entry</Button>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-4 bg-neutral-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <Input type="text" placeholder="Search entries..." className="pl-9 bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white"><Filter className="w-4 h-4 mr-2" /> Filters</Button>
            <Button variant="outline" className="bg-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
              Sort
            </Button>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">
                <input type="checkbox" className="rounded border-neutral-300" />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-center">
                  <input type="checkbox" className="rounded border-neutral-300" />
                </TableCell>
                <TableCell className="font-mono text-sm text-neutral-500">{entry.id}</TableCell>
                <TableCell className="font-medium text-neutral-900">
                  <Link to={`/content-types/${contentType.slug}/entries/${entry.id}`} className="hover:underline hover:text-blue-600 focus:outline-none">
                    {entry.data.name}
                  </Link>
                </TableCell>
                <TableCell className="text-neutral-600">{entry.data.category}</TableCell>
                <TableCell className="font-mono">
                  {entry.data.price ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(entry.data.price) : '-'}
                </TableCell>
                <TableCell>
                  {entry.status === 'Published' ? (
                    <Badge variant="success" className="bg-green-100 text-green-700 hover:bg-green-100">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </TableCell>
                <TableCell className="text-neutral-500 text-sm">{entry.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-sm text-neutral-500 bg-neutral-50/50">
          <div>1-5 of {contentType.entriesCount.toLocaleString()}</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>&lt;</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-blue-50 text-blue-700 border-blue-200">1</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white">2</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white">3</Button>
            <span className="px-2">...</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white">50</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white">&gt;</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
