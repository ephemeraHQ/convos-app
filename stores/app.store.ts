import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

type FullScreenLoaderOptions = {
  isVisible?: boolean
  texts?: string[]
}

type AppStoreType = {
  // State
  reactQueryIsHydrated: boolean
  multiInboxIsHydrated: boolean
  isInternetReachable: boolean
  fullScreenLoaderOptions: FullScreenLoaderOptions

  // Actions
  actions: {
    setReactQueryIsHydrated: (isHydrated: boolean) => void
    setMultiInboxIsHydrated: (isHydrated: boolean) => void
    setIsInternetReachable: (reachable: boolean) => void
    setFullScreenLoaderOptions: (options: FullScreenLoaderOptions) => void
  }
}

export const useAppStore = create<AppStoreType>()(
  subscribeWithSelector((set) => ({
    // State
    reactQueryIsHydrated: false,
    multiInboxIsHydrated: false,
    isInternetReachable: false,
    fullScreenLoaderOptions: {},

    // Actions
    actions: {
      setReactQueryIsHydrated: (isHydrated) => set(() => ({ reactQueryIsHydrated: isHydrated })),

      setMultiInboxIsHydrated: (isHydrated) => set(() => ({ multiInboxIsHydrated: isHydrated })),

      setIsInternetReachable: (reachable) => set(() => ({ isInternetReachable: reachable })),

      setFullScreenLoaderOptions: (options) => set(() => ({ fullScreenLoaderOptions: options })),
    },
  })),
)
