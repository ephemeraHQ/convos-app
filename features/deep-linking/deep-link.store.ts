import { create } from "zustand"
import { deepLinkLogger } from "@/utils/logger/logger"

/**
 * Deep Link Store handles two key aspects of deep linking:
 * 
 * 1. Deduplication: Prevents the same deep link from being processed multiple times
 *    Example: When a user taps a notification that opens a conversation, we need
 *    to ensure we don't create duplicate navigation actions if the link is handled
 *    by multiple systems (universal links, app scheme, etc.)
 * 
 * 2. Pending links: Stores deep links that arrive when the user isn't authenticated
 *    Example: User opens the app via a deep link but needs to sign in first. We
 *    store the link and process it after authentication completes.
 */
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
      deepLinkLogger.debug(`Setting pending deep link: ${deepLink}`)
      set({ pendingDeepLink: deepLink })
    },
    clearPendingDeepLink: () => {
      deepLinkLogger.debug("Clearing pending deep link")
      set({ pendingDeepLink: null })
    },
    markDeepLinkAsProcessed: (deepLink) => {
      const timestamp = Date.now()
      deepLinkLogger.debug(`Marking deep link as processed: ${deepLink}`)
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
        deepLinkLogger.debug(`Skipping duplicate deep link that was processed ${now - processedTimestamp}ms ago: ${deepLink}`)
      }
      
      return isRecent
    },
  },
}))
