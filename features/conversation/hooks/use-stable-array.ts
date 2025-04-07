import { useMemo } from "react"

// Generic hook for stable array memoization
export function useStableArray<T>(array: T[], separator = "|"): T[] {
  // Use the string representation as dependency
  return useMemo(
    () => {
      // Only changing when the string changes
      return [...array]
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [array.join(separator)],
  )
}
