import { useParams } from "react-router-dom"
import { contentTypes } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// The organization lives in the URL (/orgs/:orgId/...), the same way the
// backend puts it in every API path. AppShell has already checked that the
// signed-in user really belongs to it, so pages under it can trust this.
export function useOrgId() {
  const { orgId } = useParams()
  return Number(orgId)
}

// Builds links that stay inside the current organization:
//   const orgPath = useOrgPath();  orgPath("/content-types")  ->  "/orgs/3/content-types"
export function useOrgPath() {
  const orgId = useOrgId()
  return (path = "") => `/orgs/${orgId}${path}`
}

// Finds the content type named by :slug in the URL. The API is addressed by
// numeric id, but URLs read better with the slug, so the slug is matched
// against the organization's content type list.
export function useContentTypeFromSlug() {
  const orgId = useOrgId()
  const { slug } = useParams()
  const types = useApi(() => contentTypes.list(orgId), [orgId])
  const contentType = types.data?.find((ct) => ct.slug === slug) ?? null
  return { ...types, contentType }
}
