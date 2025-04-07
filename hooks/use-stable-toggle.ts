import { useCallback } from "react"
import { useLatestRef } from "./use-latest-ref"

/**
 * Creates a stable callback function for toggling boolean state without
 * adding the value to dependency arrays.
 *
 * @param value Current boolean value to toggle
 * @param setValue Function to set the new value
 * @returns A stable callback that toggles the value
 */
export function useStableToggle<T>(value: boolean, setValue: (value: boolean) => void) {
  const valueRef = useLatestRef(value)

  const toggle = useCallback(() => {
    setValue(!valueRef.current)
  }, [setValue, valueRef])

  return toggle
}
