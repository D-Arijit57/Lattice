import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { auth, type User } from "@/lib/api"

type AuthContextValue = {
  user: User | null
  // status distinguishes "still checking" from "checked, not logged in" -
  // without it the route guard would redirect to /login for a split
  // second on every page load, even for a logged-in user, before the
  // /me call resolves.
  status: "loading" | "authenticated" | "unauthenticated"
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading")

  async function refreshUser() {
    try {
      const me = await auth.me()
      setUser(me)
      setStatus("authenticated")
    } catch {
      setUser(null)
      setStatus("unauthenticated")
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  async function login(email: string, password: string) {
    await auth.login({ email, password })
    await refreshUser()
  }

  async function signup(name: string, email: string, password: string) {
    await auth.signup({ name, email, password })
    await login(email, password)
  }

  async function logout() {
    await auth.logout()
    setUser(null)
    setStatus("unauthenticated")
  }

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
