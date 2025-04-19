import { create } from "zustand"
import { deepLinkLogger } from "@/utils/logger/logger"

type IDeepLinkStore = {
  // State
  pendingDeepLink: string | null
  processedDeepLinks: Record<string, number>

  // Actions
  actions: {
    setPendingDeepLink: (deepLink: string | null) => void
    clearPendingDeepLink: () => void
    markDeepLinkAsProcessed: (deepLink: string) => void
    hasProcessedRecentlyDeepLink: (deepLink: string, timeWindowMs?: number) => boolean
  }
}

export const useDeepLinkStore = create<IDeepLinkStore>((set, get) => ({
  // State
  pendingDeepLink: null,
  processedDeepLinks: {},

  // Actions
  actions: {
    setPendingDeepLink: (deepLink) => {
      deepLinkLogger.info(`Setting pending deep link: ${deepLink}`)
      set({ pendingDeepLink: deepLink })
    },
    clearPendingDeepLink: () => {
      deepLinkLogger.info("Clearing pending deep link")
      set({ pendingDeepLink: null })
    },
    markDeepLinkAsProcessed: (deepLink) => {
      const timestamp = Date.now()
      deepLinkLogger.info(`Marking deep link as processed: ${deepLink}`)
      set((state) => ({
        processedDeepLinks: {
          ...state.processedDeepLinks,
          [deepLink]: timestamp,
        },
      }))
    },
    hasProcessedRecentlyDeepLink: (deepLink, timeWindowMs = 3000) => {
      const processedTimestamp = get().processedDeepLinks[deepLink]
      if (!processedTimestamp) return false
      
      const now = Date.now()
      const isRecent = now - processedTimestamp < timeWindowMs
      
      if (isRecent) {
        deepLinkLogger.info(`Skipping duplicate deep link that was processed ${now - processedTimestamp}ms ago: ${deepLink}`)
      }
      
      return isRecent
    },
  },
}))
