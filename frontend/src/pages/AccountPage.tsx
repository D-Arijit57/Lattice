import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { NOTIFICATIONS_CHANGED, NotificationBell } from "@/components/layout/NotificationBell"
import { useAuth } from "@/lib/auth-context"
import { errorMessage, myInvitations, organizations } from "@/lib/api"
import { ROLE, roleLabel } from "@/lib/roles"
import { useApi } from "@/lib/use-api"
import { formatDate } from "@/lib/utils"
import type { Invitation } from "@/types"

const ROLE_BADGE: Record<number, "default" | "warning" | "secondary" | "outline"> = {
  [ROLE.OWNER]: "default",
  [ROLE.ADMIN]: "warning",
  [ROLE.EDITOR]: "secondary",
  [ROLE.VIEWER]: "outline",
}

// What each role may do, in the words a person would use. Shown next to the
// roles so "Editor" is not a mystery.
const ROLE_SUMMARY: Record<number, string> = {
  [ROLE.VIEWER]: "Can read everything except API keys and members.",
  [ROLE.EDITOR]: "Can also change entries and draft fields, and ask for a publish.",
  [ROLE.ADMIN]: "Can also manage content types, publishing, API keys and members.",
  [ROLE.OWNER]: "Can also change roles, hand over ownership and delete the organization.",
}

// Your own page: who you are, which organizations you are in and as what, and
// the invitations waiting for an answer. It lives outside any organization, so
// it has its own small header (with the notifications bell) instead of the
// organization sidebar.
export function AccountPage() {
  const { user, logout } = useAuth()
  const orgs = useApi(() => organizations.list(), [])
  const invites = useApi(() => myInvitations.list(), [])

  // The invitation being answered right now, so its buttons can be disabled.
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set after accepting, to offer a way straight into the new organization.
  const [joined, setJoined] = useState<Invitation | null>(null)

  async function answer(invitation: Invitation, accept: boolean) {
    setBusyId(invitation.id)
    setError(null)
    try {
      if (accept) {
        setJoined(await myInvitations.accept(invitation.id))
      } else {
        await myInvitations.decline(invitation.id)
      }
      invites.reload()
      // Joining adds an organization to the list below.
      orgs.reload()
      // The server marks the invitation's notification read: refresh the bell.
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-logo text-2xl text-neutral-900 leading-none">Lattice</Link>
          <NotificationBell />
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="bg-white">
            <Link to="/">Back to workspace</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => logout()}>Log out</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Account</h2>
        <p className="text-neutral-500 mt-1">{user?.name} · {user?.email}</p>

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
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
            <ul className="divide-y divide-neutral-100">
              {invites.data.map((invitation) => (
                <li key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {invitation.organization_name}{" "}
                      <Badge variant={ROLE_BADGE[invitation.role_id] ?? "outline"} className="ml-1">
                        {roleLabel(invitation.role_id)}
                      </Badge>
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">
                      Invited by {invitation.invited_by_name} on {formatDate(invitation.created_at)}.{" "}
                      {ROLE_SUMMARY[invitation.role_id]}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white"
                      disabled={busyId === invitation.id}
                      onClick={() => answer(invitation, false)}
                    >
                      Decline
                    </Button>
                    <Button size="sm" disabled={busyId === invitation.id} onClick={() => answer(invitation, true)}>
                      Accept
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
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
                      <Badge variant={ROLE_BADGE[organization.my_role] ?? "outline"} className="ml-1">
                        {roleLabel(organization.my_role)}
                      </Badge>
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
