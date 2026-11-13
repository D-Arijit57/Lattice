import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ROLE_STYLE, roleLabel } from "@/lib/roles"

// The one place a role is drawn as a label, so it has the same soft colour
// everywhere: owner violet, admin blue, editor green, viewer grey.
export function RoleBadge({ role, className }: { role: number; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ROLE_STYLE[role] ?? "border-neutral-200 text-neutral-600", className)}
    >
      {roleLabel(role)}
    </Badge>
  )
}
