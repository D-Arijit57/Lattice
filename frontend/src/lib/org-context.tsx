import { createContext, useContext, type ReactNode } from "react"
import { roleCan, type Permission } from "@/lib/roles"
import type { Organization } from "@/types"

// AppShell already loads the organization (it needs it for the sidebar), so it
// puts it in this context and every page below can read it without asking the
// API again.
const OrgContext = createContext<Organization | null>(null)

export function OrgProvider({ organization, children }: { organization: Organization; children: ReactNode }) {
  return <OrgContext.Provider value={organization}>{children}</OrgContext.Provider>
}

export function useOrganization(): Organization {
  const organization = useContext(OrgContext)
  if (!organization) throw new Error("useOrganization must be used inside an organization page")
  return organization
}

// The signed-in user's role in the current organization (0 to 3).
export function useMyRole(): number {
  return useOrganization().my_role
}

// Ask "may I?" for one action:
//   const can = useCan()
//   {can("editEntries") && <Button>New entry</Button>}
export function useCan() {
  const role = useMyRole()
  return (permission: Permission) => roleCan(role, permission)
}
