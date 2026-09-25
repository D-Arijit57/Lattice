import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"

// The three "not the happy path" screens every data page needs.

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="py-16 text-center text-sm text-neutral-400 font-mono">{label}</div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-red-600">Could not load this.</p>
      <p className="text-sm text-neutral-500 mt-1">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="py-16 text-center">
      <p className="font-medium text-neutral-900">{title}</p>
      {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
