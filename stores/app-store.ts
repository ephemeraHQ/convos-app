import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

type AppStoreType = {
  // State
  reactQueryIsHydrated: boolean
  multiInboxIsHydrated: boolean
  isInternetReachable: boolean

  // Actions
  actions: {
    setReactQueryIsHydrated: (isHydrated: boolean) => void
    setMultiInboxIsHydrated: (isHydrated: boolean) => void
    setIsInternetReachable: (reachable: boolean) => void
  }
}

export const useAppStore = create<AppStoreType>()(
  subscribeWithSelector((set) => ({
    // State
    reactQueryIsHydrated: false,
    multiInboxIsHydrated: false,
    isInternetReachable: false,

    // Actions
    actions: {
      setReactQueryIsHydrated: (isHydrated) => set(() => ({ reactQueryIsHydrated: isHydrated })),

      setMultiInboxIsHydrated: (isHydrated) => set(() => ({ multiInboxIsHydrated: isHydrated })),

      setIsInternetReachable: (reachable) => set(() => ({ isInternetReachable: reachable })),
    },
  })),
)

export function isInternetReachable() {
  return useAppStore.getState().isInternetReachable
}
