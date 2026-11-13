import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { cn, formatDateTime } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { errorMessage, notifications } from "@/lib/api"
import { notificationLink } from "@/lib/notification-link"
import type { AppNotification } from "@/types"

// How often the unread number is refreshed. There is no push from the server,
// so the bell simply asks again every so often.
const POLL_MS = 30_000

// Other pages dispatch this on `window` after they change notifications on the
// server (for example answering an invitation), so the badge updates now
// instead of at the next poll.
export const NOTIFICATIONS_CHANGED = "lattice:notifications-changed"

export function NotificationBell() {
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  // null = not loaded yet (or loading); the list is fetched when the menu opens.
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshCount = useCallback(async () => {
    try {
      const { unread: count } = await notifications.unreadCount()
      setUnread(count)
    } catch {
      // A failed poll is not worth interrupting anyone: keep the old number.
    }
  }, [])

  // Poll while the page is open. A hidden tab skips the request, and coming
  // back to the tab refreshes straight away.
  useEffect(() => {
    refreshCount()
    const timer = setInterval(() => {
      if (!document.hidden) refreshCount()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) refreshCount()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount)
    }
  }, [refreshCount])

  async function loadList() {
    setError(null)
    try {
      setItems(await notifications.list())
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setItems(null)
      loadList()
      refreshCount()
    }
  }

  async function handleSelect(notification: AppNotification) {
    const link = notificationLink(notification)
    if (!notification.is_read) {
      // Update the screen first and tell the server in the background, so the
      // click feels instant. If the server call fails, re-read the real count.
      setItems((current) => current?.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)) ?? null)
      setUnread((count) => Math.max(0, count - 1))
      notifications.markRead(notification.id).catch(refreshCount)
    }
    if (link) navigate(link)
  }

  async function handleMarkAll() {
    setItems((current) => current?.map((n) => ({ ...n, is_read: true })) ?? null)
    setUnread(0)
    try {
      await notifications.markAllRead()
    } catch {
      refreshCount()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Notifications</p>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={handleMarkAll}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {error && <p className="px-3 py-6 text-center text-sm text-red-600">{error}</p>}
          {!error && items === null && <p className="px-3 py-6 text-center text-sm text-neutral-500">Loading...</p>}
          {!error && items?.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">You're all caught up.</p>
          )}
          {items?.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onSelect={() => handleSelect(notification)}
              className="flex cursor-pointer items-start gap-3 px-3 py-2.5"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  notification.is_read ? "bg-transparent" : "bg-blue-600",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className={cn("text-sm", notification.is_read ? "text-neutral-600" : "font-medium text-neutral-900")}>
                  {notification.message}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{formatDateTime(notification.created_at)}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
