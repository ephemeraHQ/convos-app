import { useEffect } from "react"
import { InteractionManager } from "react-native"

export function useEffectAfterInteractions(effect: () => void, deps?: React.DependencyList) {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      effect()
    })

    return () => task.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
