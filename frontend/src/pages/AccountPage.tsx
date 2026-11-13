import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { AccountHeader } from "@/components/account/AccountHeader"
import { InvitationList } from "@/components/account/InvitationList"
import { RoleBadge } from "@/components/RoleBadge"
import { useAuth } from "@/lib/auth-context"
import { myInvitations, organizations } from "@/lib/api"
import { ROLE_SUMMARY, roleLabel } from "@/lib/roles"
import { useApi } from "@/lib/use-api"
import type { Invitation } from "@/types"

// Your own page: who you are, which organizations you are in and as what, and
// the invitations waiting for an answer. It lives outside any organization, so
// it has its own small header (with the notifications bell) instead of the
// organization sidebar.
export function AccountPage() {
  const { user } = useAuth()
  const orgs = useApi(() => organizations.list(), [])
  const invites = useApi(() => myInvitations.list(), [])
  // Set after accepting, to offer a way straight into the new organization.
  const [joined, setJoined] = useState<Invitation | null>(null)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AccountHeader>
        <Button asChild variant="outline" size="sm" className="bg-white">
          <Link to="/">Back to workspace</Link>
        </Button>
      </AccountHeader>

      <main className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Account</h2>
        <p className="text-neutral-500 mt-1">{user?.name} · {user?.email}</p>

        {joined && (
          <p className="mt-6 flex items-center justify-between gap-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span>You joined {joined.organization_name} as {roleLabel(joined.role_id)}.</span>
            <Button asChild size="sm">
              <Link to={`/orgs/${joined.organization}`}>Open</Link>
            </Button>
          </p>
        )}

        <h3 className="text-lg font-semibold text-neutral-900 mt-10 mb-4">Invitations</h3>
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          {invites.loading && !invites.data && <LoadingState />}
          {invites.error != null && <ErrorState error={invites.error} onRetry={invites.reload} />}
          {invites.data && invites.data.length === 0 && (
            <EmptyState
              title="No pending invitations"
              description="When someone invites you to an organization, it shows up here."
            />
          )}
          {invites.data && invites.data.length > 0 && (
            <InvitationList
              invitations={invites.data}
              onAnswered={(invitation, accepted) => {
                if (accepted) setJoined(invitation)
                invites.reload()
                // Joining adds an organization to the list below.
                orgs.reload()
              }}
            />
          )}
        </div>

        <h3 className="text-lg font-semibold text-neutral-900 mt-10 mb-4">Your organizations</h3>
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          {orgs.loading && !orgs.data && <LoadingState />}
          {orgs.error != null && <ErrorState error={orgs.error} onRetry={orgs.reload} />}
          {orgs.data && orgs.data.length === 0 && (
            <EmptyState title="No organizations yet" description="Accept an invitation or create your own from the home page." />
          )}
          {orgs.data && orgs.data.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {orgs.data.map((organization) => (
                <li key={organization.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {organization.name}{" "}
                      <RoleBadge role={organization.my_role} className="ml-1" />
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">{ROLE_SUMMARY[organization.my_role]}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 bg-white">
                    <Link to={`/orgs/${organization.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
