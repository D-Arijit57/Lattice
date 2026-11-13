import { useNavigate } from "react-router-dom"
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm"
import { AccountHeader } from "@/components/account/AccountHeader"
import { InvitationList } from "@/components/account/InvitationList"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/lib/auth-context"
import { myInvitations } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// What someone sees when they belong to no organization at all, for example a
// new hire who has just signed up: their invitations first (organization, role,
// who asked, accept or decline), and a way to start an organization of their
// own below. People who are in at least one organization never see this.
export function NoOrganizationDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const invites = useApi(() => myInvitations.list(), [])

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AccountHeader />
      <main className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Welcome, {user?.name}</h2>
        <p className="text-neutral-500 mt-1">
          You are not a member of any organization yet. Accept an invitation to join one, or create your own.
        </p>

        <h3 className="text-lg font-semibold text-neutral-900 mt-10 mb-4">Your invitations</h3>
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          {invites.loading && !invites.data && <LoadingState />}
          {invites.error != null && <ErrorState error={invites.error} onRetry={invites.reload} />}
          {invites.data && invites.data.length === 0 && (
            <EmptyState
              title="No invitations yet"
              description="Ask an admin or the owner of an organization to invite you. They find you by your name or email."
            />
          )}
          {invites.data && invites.data.length > 0 && (
            <InvitationList
              invitations={invites.data}
              onAnswered={(invitation, accepted) => {
                // Joined: go straight into the organization. Declined: refresh the list.
                if (accepted) navigate(`/orgs/${invitation.organization}`, { replace: true })
                else invites.reload()
              }}
            />
          )}
        </div>

        <h3 className="text-lg font-semibold text-neutral-900 mt-10 mb-4">Or start your own</h3>
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl p-6 max-w-sm">
          <p className="text-sm text-neutral-500 mb-4">
            An organization holds your content types and entries. You will be its owner.
          </p>
          <CreateOrganizationForm
            onCreated={(organization) => navigate(`/orgs/${organization.id}`, { replace: true })}
          />
        </div>
      </main>
    </div>
  )
}
