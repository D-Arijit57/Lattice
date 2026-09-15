import { useParams, Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mockContentTypes, mockEntries, mockSchemaFields } from "@/lib/mock-data"

export function EntryEditor() {
  const { slug, entryId } = useParams()
  const contentType = mockContentTypes.find(ct => ct.slug === slug) || mockContentTypes[0]
  const entry = mockEntries.find(e => e.id === entryId) || mockEntries[0]

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-2rem)]">
      <div className="flex items-center text-sm text-neutral-500 mb-6">
        <Link to="/content-types" className="hover:text-neutral-900 transition-colors">Content Types</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <Link to={`/content-types/${contentType.slug}`} className="hover:text-neutral-900 transition-colors">{contentType.name}</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <Link to={`/content-types/${contentType.slug}/entries`} className="hover:text-neutral-900 transition-colors">Entries</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <span className="text-neutral-900 font-mono font-medium">{entry.id}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{entry.data.name || 'Untitled'}</h2>
            <Badge variant="success" className="bg-green-100 text-green-700 hover:bg-green-100">Valid</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 font-mono">
            <span>{entry.id}</span>
            <span>·</span>
            <span>{entry.version}</span>
            <span className="font-sans">·</span>
            <span className="font-sans">Updated {entry.updatedAt}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </div>

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="mb-8 border-b border-neutral-200 rounded-none bg-transparent h-auto p-0 space-x-6 justify-start w-full">
          <TabsTrigger 
            value="form" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3"
          >
            Form
          </TabsTrigger>
          <TabsTrigger 
            value="json"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3"
          >
            JSON
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="form">
          <div className="max-w-3xl space-y-8">
            {mockSchemaFields.map((field) => (
              <div key={field.id} className="grid grid-cols-[160px_1fr] gap-6 items-start">
                <label className="text-sm font-semibold text-neutral-900 pt-2 flex items-center gap-1">
                  {field.name}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                
                <div>
                  {field.type === 'String' && (
                    <Input defaultValue={entry.data[field.name]} />
                  )}
                  
                  {field.type === 'Number' && (
                    <Input type="number" defaultValue={entry.data[field.name]} className="font-mono" />
                  )}
                  
                  {field.type === 'Enum' && (
                    <select className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                      {field.validations?.options?.map(opt => (
                        <option key={opt} value={opt} selected={entry.data[field.name] === opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  
                  {field.type === 'Boolean' && (
                    <div className="pt-2">
                       <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={entry.data[field.name]} />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  )}

                  {field.type === 'Array' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {entry.data[field.name]?.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-neutral-100 font-mono flex items-center gap-1 py-1 px-2.5">
                          {tag} <span className="text-neutral-400 hover:text-neutral-900 cursor-pointer ml-1">×</span>
                        </Badge>
                      ))}
                      <Button variant="ghost" size="sm" className="h-7 text-neutral-500 hover:text-neutral-900 font-normal">
                        + Add tag
                      </Button>
                    </div>
                  )}

                  {field.type === 'Object' && (
                    <textarea 
                      className="flex min-h-[120px] w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      defaultValue={JSON.stringify(entry.data[field.name] || {}, null, 2)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="json">
          <div className="bg-neutral-900 rounded-xl overflow-hidden text-neutral-100 font-mono text-sm shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-950 border-b border-neutral-800">
              <span className="text-neutral-400">entry.json</span>
              <Button variant="ghost" size="sm" className="h-6 text-neutral-400 hover:text-white hover:bg-neutral-800">Copy</Button>
            </div>
            <pre className="p-6 overflow-x-auto">
              <code>{JSON.stringify(entry.data, null, 2)}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
