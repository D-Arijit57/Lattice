// The four roles, as the numbers the backend stores (accounts/models.py Role).
// A higher number can do everything a lower one can, so "at least editor" is
// just `role >= ROLE.EDITOR`.
export const ROLE = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
} as const

// "RoleValue" = one of the numbers above: 0 | 1 | 2 | 3.
export type RoleValue = (typeof ROLE)[keyof typeof ROLE]

const LABELS: Record<number, string> = {
  [ROLE.VIEWER]: "Viewer",
  [ROLE.EDITOR]: "Editor",
  [ROLE.ADMIN]: "Admin",
  [ROLE.OWNER]: "Owner",
}

export function roleLabel(role: number): string {
  return LABELS[role] ?? "Unknown"
}

// What each action needs, in one table. The backend enforces the same rules and
// is the real gate: hiding a button here is only about not showing someone
// something they cannot use.
export const MINIMUM_ROLE = {
  // entries
  editEntries: ROLE.EDITOR,
  // fields are the draft schema
  editFields: ROLE.EDITOR,
  // an editor asks, an admin or owner approves
  requestPublish: ROLE.EDITOR,
  reviewPublish: ROLE.ADMIN,
  publishVersion: ROLE.ADMIN,
  // content types
  manageContentTypes: ROLE.ADMIN,
  // settings
  manageApiKeys: ROLE.ADMIN,
  manageMembers: ROLE.ADMIN,
  changeRoles: ROLE.OWNER,
  deleteOrganization: ROLE.OWNER,
} as const

// "Permission" = one of the names above, e.g. "editEntries".
export type Permission = keyof typeof MINIMUM_ROLE

export function roleCan(role: number, permission: Permission): boolean {
  return role >= MINIMUM_ROLE[permission]
}

// Roles you may hand out when inviting or changing a role. Owner is never on
// the list: ownership is transferred, not assigned.
export const ASSIGNABLE_ROLES = [ROLE.VIEWER, ROLE.EDITOR, ROLE.ADMIN] as const

// May `actorRole` remove a member who has `targetRole`? Mirrors can_remove()
// in backend/api/accounts/rules.py: the owner can remove anyone but the owner
// row, an admin can remove editors and viewers.
export function canRemoveMember(actorRole: number, targetRole: number): boolean {
  if (targetRole === ROLE.OWNER) return false
  if (actorRole === ROLE.OWNER) return true
  if (actorRole === ROLE.ADMIN) return targetRole <= ROLE.EDITOR
  return false
}
