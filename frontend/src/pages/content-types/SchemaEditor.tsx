import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Plus, MoreHorizontal, Eye, Settings2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContentType } from "@/types"
import { mockSchemaFields } from "@/lib/mock-data"

export function SchemaEditor() {
  const { contentType } = useOutletContext<{ contentType: ContentType }>()
  const [selectedField, setSelectedField] = useState(mockSchemaFields[1]) // Default to 'price'

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-neutral-900">Schema</h3>
            <p className="text-sm text-neutral-500 mt-1">Define the structure, types and validation rules.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline"><Eye className="w-4 h-4 mr-2" /> Preview</Button>
            <Button>Save changes</Button>
          </div>
        </div>

        <Tabs defaultValue="fields" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fields" className="space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50/50 border-b border-neutral-100 text-neutral-500 font-medium">
                  <tr>
                    <th className="px-6 py-3 w-12 text-center">#</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3 text-center">Required</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {mockSchemaFields.map((field, index) => (
                    <tr 
                      key={field.id} 
                      className={`hover:bg-neutral-50 cursor-pointer transition-colors ${selectedField.id === field.id ? 'bg-blue-50/50 hover:bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedField(field)}
                    >
                      <td className="px-6 py-4 text-center text-neutral-400 font-mono">{index + 1}</td>
                      <td className="px-6 py-4 font-mono font-medium text-neutral-900">{field.name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="font-mono text-xs">{field.type}</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {field.required ? (
                          <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <Button variant="outline" className="w-full border-dashed border-2 py-6 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50">
              <Plus className="w-4 h-4 mr-2" /> Add field
            </Button>
          </TabsContent>
          <TabsContent value="validation">
            <div className="text-neutral-500 py-8 text-center">Schema-level validation rules go here.</div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="text-neutral-500 py-8 text-center">Schema settings go here.</div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="w-full md:w-80 shrink-0">
        <div className="sticky top-8 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-mono font-bold text-lg text-neutral-900">{selectedField.name}</h4>
              <Badge variant="secondary" className="font-mono text-xs">{selectedField.type}</Badge>
            </div>
            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="p-5 space-y-6">
            <p className="text-sm text-neutral-500">{selectedField.description || `Configuration for the ${selectedField.name} field.`}</p>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-neutral-900">Field name</label>
                <Input value={selectedField.name} readOnly className="font-mono bg-neutral-50" />
              </div>
              
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-neutral-900">Type</label>
                <select className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500" value={selectedField.type} disabled>
                  <option value="String">String</option>
                  <option value="Number">Number</option>
                  <option value="Boolean">Boolean</option>
                  <option value="Enum">Enum</option>
                  <option value="Object">Object</option>
                  <option value="Array">Array</option>
                </select>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={selectedField.required} readOnly className="rounded border-neutral-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-4 h-4" />
                  Required field
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={selectedField.unique} readOnly className="rounded border-neutral-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-4 h-4" />
                  Unique value
                </label>
              </div>
            </div>

            <hr className="border-neutral-100" />

            <div className="space-y-4">
              <h5 className="text-sm font-semibold text-neutral-900">Validation rules</h5>
              
              {selectedField.type === 'Number' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-xs text-neutral-500">Minimum value</label>
                      <Input value={selectedField.validations?.min ?? 0} readOnly />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-neutral-500">Maximum value</label>
                      <Input placeholder="Optional" readOnly />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" checked={selectedField.validations?.integer} readOnly className="rounded border-neutral-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-4 h-4" />
                    Integer only
                  </label>
                </>
              )}

              <Button variant="outline" className="w-full justify-between mt-4">
                Advanced options <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><polyline points="9 18 15 12 9 6"/></svg>
}
