import { onlineManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { useAppStore } from "@/stores/app-store"

export function useReactQueryInit() {
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state) => state.isInternetReachable,
      (isReachable) => {
        onlineManager.setOnline(isReachable)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])
}
