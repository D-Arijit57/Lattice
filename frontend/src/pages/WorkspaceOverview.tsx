import { Plus, Settings, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { mockWorkspace, mockContentTypes, mockActivities } from "@/lib/mock-data"

export function WorkspaceOverview() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Overview</h2>
          <p className="text-neutral-500 mt-1">Your content types, recent activity and quick access.</p>
        </div>
        <div className="text-sm text-neutral-500 font-medium font-mono">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <div className="w-6 h-6 bg-blue-600 rounded-sm"></div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{mockWorkspace.name}</h3>
                  <p className="text-sm text-neutral-500">{mockWorkspace.members} members · {mockWorkspace.plan}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <h3 className="text-lg font-semibold text-neutral-900">Content Types</h3>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Content Type</Button>
            </div>
            
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-neutral-100">
                {mockContentTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <DatabaseIcon id={type.id} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-neutral-900">{type.name}</h4>
                        </div>
                        <p className="text-sm text-neutral-500 line-clamp-1">{type.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 ml-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-neutral-900">{type.entriesCount.toLocaleString()}</p>
                        <p className="text-xs text-neutral-500">entries</p>
                      </div>
                      <div className="w-24 hidden md:block">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${type.versionStatus === 'Current' ? 'bg-green-500' : 'bg-neutral-300'}`}></div>
                          <span className="text-sm font-medium font-mono text-neutral-700">{type.currentVersion}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base font-semibold">Recent Activity</CardTitle>
              <Button variant="link" className="px-0 text-sm h-auto font-normal">View all</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    <ActivityIcon type={activity.icon} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 leading-snug">{activity.action}</p>
                    <p className="text-xs text-neutral-500">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-neutral-700 bg-neutral-50 hover:bg-neutral-100">
                <Plus className="w-4 h-4 mr-2" /> Create Content Type
              </Button>
              <Button variant="outline" className="w-full justify-start text-neutral-700 bg-neutral-50 hover:bg-neutral-100">
                <Plus className="w-4 h-4 mr-2" /> Create Entry
              </Button>
              <Button variant="outline" className="w-full justify-start text-neutral-700 bg-neutral-50 hover:bg-neutral-100">
                <Settings className="w-4 h-4 mr-2" /> Manage API Keys
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DatabaseIcon({ id }: { id: string }) {
  if (id === 'ct_products') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (id === 'ct_categories') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
  if (id === 'ct_orders') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'entry-created') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M12 18v-6M9 15h6"/></svg>;
  if (type === 'schema-published') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (type === 'api-key-regenerated') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
