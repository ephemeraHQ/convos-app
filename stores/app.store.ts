import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

type AppStoreType = {
  // State
  reactQueryIsHydrated: boolean
  multiInboxIsHydrated: boolean
  isInternetReachable: boolean
  isLoggingOut: boolean

  // Actions
  actions: {
    setReactQueryIsHydrated: (isHydrated: boolean) => void
    setMultiInboxIsHydrated: (isHydrated: boolean) => void
    setIsInternetReachable: (reachable: boolean) => void
    setIsLoggingOut: (isLoggingOut: boolean) => void
  }
}

export const useAppStore = create<AppStoreType>()(
  subscribeWithSelector((set) => ({
    // State
    reactQueryIsHydrated: false,
    multiInboxIsHydrated: false,
    isInternetReachable: false,
    isLoggingOut: false,

    // Actions
    actions: {
      setReactQueryIsHydrated: (isHydrated) => set(() => ({ reactQueryIsHydrated: isHydrated })),

      setMultiInboxIsHydrated: (isHydrated) => set(() => ({ multiInboxIsHydrated: isHydrated })),

      setIsInternetReachable: (reachable) => set(() => ({ isInternetReachable: reachable })),

      setIsLoggingOut: (isLoggingOut) => set(() => ({ isLoggingOut })),
    },
  })),
)
