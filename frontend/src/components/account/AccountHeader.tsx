import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { useAuth } from "@/lib/auth-context"

// The small top bar used by pages that live outside an organization (the
// account page and the dashboard for people who are not in one yet), so they
// do not need the organization sidebar.
export function AccountHeader({ children }: { children?: ReactNode }) {
  const { logout } = useAuth()
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-logo text-2xl text-neutral-900 leading-none">Lattice</Link>
        <NotificationBell />
      </div>
      <div className="flex items-center gap-3">
        {children}
        <Button variant="ghost" size="sm" onClick={() => logout()}>Log out</Button>
      </div>
    </header>
  )
}
