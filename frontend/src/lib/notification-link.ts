import type { AppNotification } from "@/types"

// Where clicking a notification should take you. Returns null when there is
// nothing sensible to open.
export function notificationLink(notification: AppNotification): string | null {
  const { payload } = notification
  switch (notification.kind) {
    case "invitation":
      // Invitations are answered on the account page, not inside an organization.
      return "/account"
    case "publish_requested":
    case "publish_approved":
    case "publish_rejected": {
      if (payload.organization_id == null) return null
      const org = `/orgs/${payload.organization_id}`
      // A notification written before the slug was added falls back to the list.
      return payload.content_type_slug
        ? `${org}/content-types/${payload.content_type_slug}/requests`
        : `${org}/content-types`
    }
    default:
      return null
  }
}
