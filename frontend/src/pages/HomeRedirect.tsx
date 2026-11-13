import { Link, Navigate, useNavigate } from "react-router-dom"
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { myInvitations, organizations } from "@/lib/api"
import { roleLabel } from "@/lib/roles"
import { useApi } from "@/lib/use-api"

// "/" has no organization in it, so this page picks one: the user's first
// organization if they have any, otherwise a screen to create their first.
export function HomeRedirect() {
  const navigate = useNavigate()
  const orgs = useApi(() => organizations.list(), [])
  // A new hire usually arrives here with no organization but with an invitation
  // waiting, so that is shown first. If this call fails the screen still works.
  const invites = useApi(() => myInvitations.list(), [])

  if (orgs.loading) return <LoadingState />
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />

  if (orgs.data && orgs.data.length > 0) {
    return <Navigate to={`/orgs/${orgs.data[0].id}`} replace />
  }

  const waiting = invites.data ?? []

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
        <h1 className="font-logo text-3xl text-neutral-900 leading-none mb-2">Lattice</h1>

        {waiting.length > 0 && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              You have {waiting.length === 1 ? "an invitation" : `${waiting.length} invitations`}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {waiting.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-2">
                  {invitation.organization_name}
                  <Badge variant="secondary">{roleLabel(invitation.role_id)}</Badge>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-4 w-full">
              <Link to="/account">Review invitations</Link>
            </Button>
          </div>
        )}

        <h2 className="text-lg font-semibold text-neutral-900 mt-6">
          {waiting.length > 0 ? "Or create your own organization" : "Create your first organization"}
        </h2>
        <p className="text-sm text-neutral-500 mt-1 mb-6">
          An organization holds your content types and entries. You can belong to several.
        </p>
        <CreateOrganizationForm
          onCreated={(organization) => navigate(`/orgs/${organization.id}`, { replace: true })}
        />
        {waiting.length === 0 && (
          <p className="text-sm text-neutral-500 mt-6 text-center">
            Waiting for an invitation?{" "}
            <Link to="/account" className="text-blue-600 hover:underline">Open your account</Link>
          </p>
        )}
      </div>
    </div>
  )
}
