import { useCallback, useEffect, useRef } from "react"
import { waitUntilPromise } from "@/utils/wait-until-promise"

export function useWaitUntil<T>(args: {
  thing: T
  intervalMs?: number
  timeoutMs?: number
  errorMessage?: string
}) {
  const { thing, intervalMs, timeoutMs, errorMessage } = args

  const ref = useRef<T>(thing)

  useEffect(() => {
    ref.current = thing
  }, [thing])

  const waitUntil = useCallback(() => {
    return waitUntilPromise({
      checkFn: () => {
        return ref.current
      },
      intervalMs,
      timeoutMs,
      errorMessage,
    })
  }, [intervalMs, timeoutMs, errorMessage])

  return {
    waitUntil,
  }
}
