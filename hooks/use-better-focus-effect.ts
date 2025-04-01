import { useFocusEffect } from "@react-navigation/native"
import { useCallback, useRef } from "react"

export function useBetterFocusEffect(fn: () => void | (() => void)) {
  const hasRunRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      // Skip if we've already run this effect once
      if (hasRunRef.current) {
        return
      }

      hasRunRef.current = true
      const cleanup = fn()

      // Return a cleanup function that both calls the original cleanup
      // and resets hasRunRef so the effect runs again next time
      return () => {
        // Call the original cleanup function if it exists
        if (typeof cleanup === "function") {
          cleanup()
        }

        // Reset the flag so the effect will run again when the screen is focused
        hasRunRef.current = false
      }
    }, [fn]),
  )
}
