import { useEffect, useState } from "react"

type ApiState<T> = {
  data: T | null
  error: unknown
  loading: boolean
}

// Runs an API call when the component appears (and again whenever `deps`
// change) and hands back the three things every page needs to draw itself:
// the data, an error, and whether it is still loading.
//
//   const types = useApi(() => contentTypes.list(orgId), [orgId])
//   types.loading / types.error / types.data / types.reload()
//
// reload() runs the call again - used after a create, so a new row shows up.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true })
  // Bumping this number is what makes reload() re-run the effect below.
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    // If the page changes (or unmounts) before the answer arrives, the late
    // answer must not overwrite newer state. `ignore` is that guard.
    let ignore = false

    setState((previous) => ({ ...previous, error: null, loading: true }))
    fetcher()
      .then((data) => {
        if (!ignore) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (!ignore) setState({ data: null, error, loading: false })
      })

    return () => {
      ignore = true
    }
    // fetcher is rebuilt on every render, so it is deliberately not a
    // dependency; `deps` is the list of things that really change the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount])

  return { ...state, reload: () => setReloadCount((count) => count + 1) }
}
