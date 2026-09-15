import { useOutletContext } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ContentType } from "@/types"
import { mockSchemaVersions } from "@/lib/mock-data"

export function SchemaVersions() {
  const { contentType } = useOutletContext<{ contentType: ContentType }>()
  const selectedVersion = mockSchemaVersions[0]

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-neutral-900">Schema Versions</h3>
          <p className="text-sm text-neutral-500 mt-1">Track changes to your schema over time.</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New version</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-4 bottom-4 w-px bg-neutral-200"></div>
          
          <div className="space-y-6">
            {mockSchemaVersions.map((version) => (
              <div key={version.id} className="relative pl-12">
                <div className="absolute left-[13px] top-5 w-2 h-2 rounded-full bg-neutral-400 border-2 border-white ring-2 ring-transparent"></div>
                
                <div className={`p-6 rounded-xl border transition-colors cursor-pointer ${selectedVersion.id === version.id ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-50' : 'bg-neutral-50/50 border-neutral-200 hover:bg-white hover:border-neutral-300'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-mono text-lg font-bold text-neutral-900">{version.version}</h4>
                    {version.status === 'Current' && (
                      <Badge variant="success" className="bg-green-100 text-green-700">Current</Badge>
                    )}
                  </div>
                  <p className="text-neutral-900 font-medium mb-4">{version.summary}</p>
                  <div className="flex items-center justify-between text-sm text-neutral-500">
                    <div className="flex items-center gap-2">
                      <span>{version.createdAt}</span>
                      <span>·</span>
                      <span>{version.createdBy}</span>
                    </div>
                    <span className="font-medium text-neutral-700">{version.fieldsCount} fields</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full md:w-80 shrink-0">
          <div className="sticky top-8 bg-neutral-50 rounded-xl border border-neutral-200 p-6">
            <h4 className="font-semibold text-neutral-900 mb-6">Version details</h4>
            
            <dl className="space-y-4 text-sm mb-8">
              <div className="grid grid-cols-3">
                <dt className="text-neutral-500">Version</dt>
                <dd className="col-span-2 font-mono font-medium text-neutral-900">{selectedVersion.version}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-neutral-500">Created</dt>
                <dd className="col-span-2 text-neutral-900">{selectedVersion.createdAt}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-neutral-500">Created by</dt>
                <dd className="col-span-2 text-neutral-900">{selectedVersion.createdBy}</dd>
              </div>
              <div className="grid grid-cols-3">
                <dt className="text-neutral-500">Fields</dt>
                <dd className="col-span-2 font-medium text-neutral-900">{selectedVersion.fieldsCount}</dd>
              </div>
            </dl>

            <h5 className="font-semibold text-neutral-900 mb-4">Changes</h5>
            <ul className="space-y-3 mb-8">
              {selectedVersion.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-400 shrink-0"></span>
                  {change}
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full bg-white">View changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
