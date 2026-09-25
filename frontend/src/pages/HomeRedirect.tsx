import { Navigate, useNavigate } from "react-router-dom"
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { organizations } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// "/" has no organization in it, so this page picks one: the user's first
// organization if they have any, otherwise a screen to create their first.
export function HomeRedirect() {
  const navigate = useNavigate()
  const orgs = useApi(() => organizations.list(), [])

  if (orgs.loading) return <LoadingState />
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />

  if (orgs.data && orgs.data.length > 0) {
    return <Navigate to={`/orgs/${orgs.data[0].id}`} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
        <h1 className="font-logo text-3xl text-neutral-900 leading-none mb-2">Lattice</h1>
        <h2 className="text-lg font-semibold text-neutral-900 mt-6">Create your first organization</h2>
        <p className="text-sm text-neutral-500 mt-1 mb-6">
          An organization holds your content types and entries. You can belong to several.
        </p>
        <CreateOrganizationForm
          onCreated={(organization) => navigate(`/orgs/${organization.id}`, { replace: true })}
        />
      </div>
    </div>
  )
}
