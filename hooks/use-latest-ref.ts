import { useEffect, useRef } from "react"

export function useLatestRef<T>(value: T) {
  const ref = useRef(value)

  // Keep the ref in sync with the latest value
  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
