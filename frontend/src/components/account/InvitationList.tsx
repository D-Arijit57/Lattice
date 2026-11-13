import { useState } from "react"
import { Button } from "@/components/ui/button"
import { NOTIFICATIONS_CHANGED } from "@/components/layout/NotificationBell"
import { RoleBadge } from "@/components/RoleBadge"
import { errorMessage, myInvitations } from "@/lib/api"
import { ROLE_SUMMARY } from "@/lib/roles"
import { formatDate } from "@/lib/utils"
import type { Invitation } from "@/types"

// The invitations waiting for the signed-in user: organization, the role they
// would get, who asked, and Accept / Decline. Used on the account page and on
// the dashboard for people who are not in any organization yet.
export function InvitationList({
  invitations,
  onAnswered,
}: {
  invitations: Invitation[]
  // Called after the server accepted the answer; the caller reloads or navigates.
  onAnswered: (invitation: Invitation, accepted: boolean) => void
}) {
  // The invitation being answered right now, so its buttons can be disabled.
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function answer(invitation: Invitation, accept: boolean) {
    setBusyId(invitation.id)
    setError(null)
    try {
      const updated = accept
        ? await myInvitations.accept(invitation.id)
        : await myInvitations.decline(invitation.id)
      // The server marks the invitation's notification read: refresh the bell.
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
      onAnswered(updated, accept)
    } catch (err) {
      setError(errorMessage(err))
      setBusyId(null)
    }
  }

  return (
    <>
      {error && (
        <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>
      )}
      <ul className="divide-y divide-neutral-100">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">
                {invitation.organization_name}{" "}
                <RoleBadge role={invitation.role_id} className="ml-1" />
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
    </>
  )
}
