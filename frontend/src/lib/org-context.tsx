import { createContext, useContext, type ReactNode } from "react"
import { roleCan, type Permission } from "@/lib/roles"
import type { Organization } from "@/types"

type OrgContextValue = {
  organization: Organization
  // Loads the organizations again, e.g. after your own role changed.
  reload: () => void
}

// AppShell already loads the organization (it needs it for the sidebar), so it
// puts it in this context and every page below can read it without asking the
// API again.
const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  organization,
  reload,
  children,
}: {
  organization: Organization
  reload: () => void
  children: ReactNode
}) {
  return <OrgContext.Provider value={{ organization, reload }}>{children}</OrgContext.Provider>
}

function useOrgContext(): OrgContextValue {
  const value = useContext(OrgContext)
  if (!value) throw new Error("This must be used inside an organization page")
  return value
}

export function useOrganization(): Organization {
  return useOrgContext().organization
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

// Call this after something changed your own role (like handing over ownership),
// so the sidebar and every button re-read it.
export function useReloadOrganization(): () => void {
  return useOrgContext().reload
}
