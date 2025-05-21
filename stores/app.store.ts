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
  isShowingFullScreenOverlay: boolean
  isLoggingOut: boolean

  // Actions
  actions: {
    setReactQueryIsHydrated: (isHydrated: boolean) => void
    setMultiInboxIsHydrated: (isHydrated: boolean) => void
    setIsInternetReachable: (reachable: boolean) => void
    setFullScreenLoaderOptions: (options: FullScreenLoaderOptions) => void
    setIsShowingFullScreenOverlay: (isShowing: boolean) => void
    setIsLoggingOut: (isLoggingOut: boolean) => void
  }
}

export const useAppStore = create<AppStoreType>()(
  subscribeWithSelector((set) => ({
    // State
    reactQueryIsHydrated: false,
    multiInboxIsHydrated: false,
    isInternetReachable: false,
    fullScreenLoaderOptions: {},
    isShowingFullScreenOverlay: false,
    isLoggingOut: false,

    // Actions
    actions: {
      setReactQueryIsHydrated: (isHydrated) => set(() => ({ reactQueryIsHydrated: isHydrated })),

      setMultiInboxIsHydrated: (isHydrated) => set(() => ({ multiInboxIsHydrated: isHydrated })),

      setIsInternetReachable: (reachable) => set(() => ({ isInternetReachable: reachable })),

      setFullScreenLoaderOptions: (options) => set(() => ({ fullScreenLoaderOptions: options })),

      setIsShowingFullScreenOverlay: (isShowing) =>
        set(() => ({ isShowingFullScreenOverlay: isShowing })),

      setIsLoggingOut: (isLoggingOut) => set(() => ({ isLoggingOut })),
    },
  })),
)
