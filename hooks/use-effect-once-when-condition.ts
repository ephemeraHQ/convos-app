import { useEffect, useRef } from "react"

export function useEffectWhenCondition(effect: () => void, condition: boolean) {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (condition && !hasRunRef.current) {
      hasRunRef.current = true
      effect()
    }
  }, [condition, effect])
}
