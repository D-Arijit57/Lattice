import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { errorMessage, invitations, userSearch } from "@/lib/api"
import { ASSIGNABLE_ROLES, ROLE, roleLabel } from "@/lib/roles"
import type { UserSearchResult } from "@/types"

// The server only searches from this many characters on.
const MIN_SEARCH_CHARS = 2
// Wait for a pause in typing before asking the server, so "ada" is one request
// and not three.
const SEARCH_DELAY_MS = 300

export function InviteMemberDialog({
  orgId,
  open,
  onOpenChange,
  onInvited,
}: {
  orgId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  // The person chosen from the results. While this is set, the search box is
  // replaced by their name.
  const [picked, setPicked] = useState<UserSearchResult | null>(null)
  const [roleId, setRoleId] = useState<number>(ROLE.VIEWER)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setQuery("")
    setResults([])
    setSearching(false)
    setSearchError(null)
    setPicked(null)
    setRoleId(ROLE.VIEWER)
    setError(null)
    setSubmitting(false)
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  // Searches whenever the text changes. The cleanup function runs before the
  // next search starts (or when the dialog closes): it cancels the pending
  // timer and marks this run as stale, so a slow answer to an old query can
  // never overwrite the results of a newer one.
  useEffect(() => {
    const text = query.trim()
    if (picked || text.length < MIN_SEARCH_CHARS) {
      setResults([])
      setSearchError(null)
      return
    }
    let stale = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const found = await userSearch.find(orgId, text)
        if (!stale) setResults(found)
      } catch (err) {
        if (!stale) setSearchError(errorMessage(err))
      } finally {
        if (!stale) setSearching(false)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, picked, orgId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!picked) return
    setSubmitting(true)
    setError(null)
    try {
      await invitations.create(orgId, { invited_user: picked.id, role_id: roleId })
      onInvited()
      handleClose(false)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const searchedLongEnough = query.trim().length >= MIN_SEARCH_CHARS

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Find someone who already has a Lattice account. They join when they accept the invitation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="invite-search" className="text-sm font-semibold text-neutral-900">
              Person
            </label>
            {picked ? (
              <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{picked.name}</p>
                  <p className="truncate text-xs text-neutral-500">{picked.email}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="invite-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  autoComplete="off"
                  autoFocus
                />
                {!searchedLongEnough && (
                  <p className="text-xs text-neutral-500">Type at least {MIN_SEARCH_CHARS} characters.</p>
                )}
                {searching && <p className="text-xs text-neutral-500">Searching...</p>}
                {searchError && <p className="text-sm text-red-600">{searchError}</p>}
                {searchedLongEnough && !searching && !searchError && results.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    No one found. They need an account, and they must not be a member already.
                  </p>
                )}
                {results.length > 0 && (
                  <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
                    {results.map((result) => (
                      <li key={result.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(result)}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                        >
                          <p className="text-sm font-medium text-neutral-900">{result.name}</p>
                          <p className="text-xs text-neutral-500">{result.email}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="invite-role" className="text-sm font-semibold text-neutral-900">
              Role
            </label>
            <select
              id="invite-role"
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500">
              Viewers can read. Editors can also change entries and draft fields. Admins can also
              manage content types, publishing, API keys and members.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting || !picked}>
            {submitting ? "Sending..." : "Send invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
