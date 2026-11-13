import { Navigate } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { NoOrganizationDashboard } from "@/pages/NoOrganizationDashboard"
import { organizations } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// "/" has no organization in it, so this page picks one: the user's first
// organization if they have any, otherwise the dashboard for people who are
// not in an organization yet (their invitations, and a way to create one).
export function HomeRedirect() {
  const orgs = useApi(() => organizations.list(), [])

  if (orgs.loading) return <LoadingState />
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />

  if (orgs.data && orgs.data.length > 0) {
    return <Navigate to={`/orgs/${orgs.data[0].id}`} replace />
  }

  return <NoOrganizationDashboard />
}
