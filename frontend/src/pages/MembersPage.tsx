import { useState } from "react"
import { UserPlus } from "lucide-react"
import { RoleBadge } from "@/components/RoleBadge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InviteMemberDialog } from "@/components/forms/InviteMemberDialog"
import { useAuth } from "@/lib/auth-context"
import { errorMessage, invitations, members } from "@/lib/api"
import { useCan, useMyRole, useReloadOrganization } from "@/lib/org-context"
import { ASSIGNABLE_ROLES, ROLE, canRemoveMember, roleLabel } from "@/lib/roles"
import { useApi } from "@/lib/use-api"
import { useOrgId } from "@/lib/use-org"
import { formatDate } from "@/lib/utils"
import type { Invitation, Member } from "@/types"

// The guard is a separate component so the content below (which loads the
// member list) never starts for someone the API would refuse.
export function MembersPage() {
  const can = useCan()
  if (!can("manageMembers")) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <EmptyState
          title="Members are managed by admins"
          description="Ask an admin or the owner of this organization."
        />
      </div>
    )
  }
  return <MembersContent />
}

function MembersContent() {
  const orgId = useOrgId()
  const myRole = useMyRole()
  const can = useCan()
  const { user } = useAuth()
  const reloadOrganization = useReloadOrganization()

  const memberList = useApi(() => members.list(orgId), [orgId])
  const inviteList = useApi(() => invitations.list(orgId), [orgId])

  const [inviteOpen, setInviteOpen] = useState(false)
  // Each of these holds the row a confirm dialog is about; null = dialog closed.
  const [removing, setRemoving] = useState<Member | null>(null)
  const [transferring, setTransferring] = useState<Member | null>(null)
  const [cancelling, setCancelling] = useState<Invitation | null>(null)
  // Role changes happen inline in the table, so their error shows as a banner.
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const isOwner = can("changeRoles")

  async function changeRole(member: Member, roleId: number) {
    setActionError(null)
    setBusyId(member.id)
    try {
      await members.changeRole(orgId, member.id, roleId)
      memberList.reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Members</h2>
          <p className="text-neutral-500 mt-1">
            People who can work in this organization, and what each of them may do.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Invite member
        </Button>
      </div>

      {actionError && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        {memberList.loading && !memberList.data && <LoadingState />}
        {memberList.error != null && <ErrorState error={memberList.error} onRetry={memberList.reload} />}
        {memberList.data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberList.data.map((member) => {
                const isMe = member.user_id === user?.id
                const isMemberOwner = member.role_id === ROLE.OWNER
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium text-neutral-900">
                        {member.name} {isMe && <span className="text-xs font-normal text-neutral-500">(you)</span>}
                      </p>
                      <p className="text-xs text-neutral-500">{member.email}</p>
                    </TableCell>
                    <TableCell>
                      {isOwner && !isMemberOwner ? (
                        // Only the owner changes roles, and never to owner (that is a transfer).
                        <select
                          aria-label={`Role of ${member.name}`}
                          value={member.role_id}
                          disabled={busyId === member.id}
                          onChange={(e) => changeRole(member, Number(e.target.value))}
                          className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>{roleLabel(role)}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={member.role_id} />
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-500">{formatDate(member.created_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isOwner && !isMemberOwner && (
                        <Button variant="outline" size="sm" className="mr-2 bg-white" onClick={() => setTransferring(member)}>
                          Make owner
                        </Button>
                      )}
                      {canRemoveMember(myRole, member.role_id) && !isMe && (
                        <Button variant="destructive" size="sm" onClick={() => setRemoving(member)}>
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <h3 className="text-lg font-semibold text-neutral-900 mt-10 mb-4">Pending invitations</h3>
      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        {inviteList.loading && !inviteList.data && <LoadingState />}
        {inviteList.error != null && <ErrorState error={inviteList.error} onRetry={inviteList.reload} />}
        {inviteList.data && inviteList.data.length === 0 && (
          <EmptyState
            title="No pending invitations"
            description="Invitations you send show up here until they are accepted or declined."
          />
        )}
        {inviteList.data && inviteList.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invited</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inviteList.data.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <p className="font-medium text-neutral-900">{invitation.invited_user_name}</p>
                    <p className="text-xs text-neutral-500">{invitation.invited_user_email}</p>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={invitation.role_id} />
                  </TableCell>
                  <TableCell className="text-neutral-500">{invitation.invited_by_name}</TableCell>
                  <TableCell className="text-neutral-500">{formatDate(invitation.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="bg-white" onClick={() => setCancelling(invitation)}>
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <InviteMemberDialog
        orgId={orgId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={inviteList.reload}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They lose access to this organization right away. You can invite them again later."
        confirmLabel="Remove"
        busyLabel="Removing..."
        onConfirm={async () => {
          await members.remove(orgId, removing!.id)
          memberList.reload()
        }}
      />

      <ConfirmDialog
        open={transferring !== null}
        onOpenChange={(open) => !open && setTransferring(null)}
        title={`Make ${transferring?.name} the owner?`}
        description="They become the owner and you become an admin. Only the owner can change roles, hand over ownership or delete the organization."
        confirmLabel="Transfer ownership"
        busyLabel="Transferring..."
        onConfirm={async () => {
          await members.transferOwnership(orgId, transferring!.id)
          // Your own role just changed: re-read it so every button follows.
          reloadOrganization()
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={`Cancel the invitation for ${cancelling?.invited_user_name}?`}
        description="They will no longer be able to accept it. You can invite them again."
        confirmLabel="Cancel invitation"
        busyLabel="Cancelling..."
        onConfirm={async () => {
          await invitations.cancel(orgId, cancelling!.id)
          inviteList.reload()
        }}
      />
    </div>
  )
}
