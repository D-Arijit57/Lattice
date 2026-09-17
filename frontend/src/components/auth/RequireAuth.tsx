import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-400 font-mono">
        Loading...
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
