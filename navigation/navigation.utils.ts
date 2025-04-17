import { createNavigationContainerRef } from "@react-navigation/native"
import * as Linking from "expo-linking"
import { Linking as RNLinking } from "react-native"
import { captureError } from "@/utils/capture-error"
import { NavigationError } from "@/utils/error"
import { waitUntilPromise } from "@/utils/wait-until-promise"
import { config } from "../config"
import { logger } from "../utils/logger/logger"
import { NavigationParamList } from "./navigation.types"

// https://reactnavigation.org/docs/navigating-without-navigation-prop/#usage
export const navigationRef = createNavigationContainerRef()

export function waitUntilNavigationReady(args: { timeoutMs?: number } = {}) {
  return waitUntilPromise({
    checkFn: () => navigationRef.isReady(),
    intervalMs: 100,
    timeoutMs: args.timeoutMs,
  })
}

export async function navigate<T extends keyof NavigationParamList>(
  screen: T,
  params?: NavigationParamList[T],
) {
  try {
    if (!navigationRef) {
      captureError(
        new NavigationError({
          error: "Navigation navigator not found",
        }),
      )
      return
    }

    if (!navigationRef.isReady()) {
      await waitUntilNavigationReady({
        // After 10 seconds, the UX will feel very broken from a user perspective...
        timeoutMs: 10000,
      })
    }

    logger.debug(`[Navigation] Navigating to ${screen} ${params ? JSON.stringify(params) : ""}`)

    // @ts-ignore
    navigationRef.navigate(screen, params)
  } catch (error) {
    captureError(
      new NavigationError({
        error,
        additionalMessage: "Error navigating to screen",
      }),
    )
  }
}

/**
 * Resets the navigation state to go to the root
 */
export async function resetNavigation() {
  try {
    if (!navigationRef || !navigationRef.isReady()) {
      await waitUntilNavigationReady({
        timeoutMs: 10000,
      })
    }

    logger.debug("[Navigation] Resetting navigation to root")
    
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "Chats" }],
    })
  } catch (error) {
    captureError(
      new NavigationError({
        error,
        additionalMessage: "Error resetting navigation",
      }),
    )
  }
}

/**
 * Resets navigation to root and then navigates to the specified screen
 * Use this for deep links to ensure we navigate from a consistent starting point
 */
export async function navigateWithReset<T extends keyof NavigationParamList>(
  screen: T,
  params?: NavigationParamList[T],
) {
  try {
    if (!navigationRef || !navigationRef.isReady()) {
      await waitUntilNavigationReady({
        timeoutMs: 10000,
      })
    }

    logger.debug(`[Navigation] Navigating with reset to ${screen} ${params ? JSON.stringify(params) : ""}`)
    
    // If we're navigating to the root Chats screen, just do a simple reset
    if (screen === "Chats" as T) {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: screen, params }],
      })
      return
    }
    
    // For other screens, reset to Chats and then add our target screen
    navigationRef.resetRoot({
      index: 1, // Set index to 1 to focus on the new screen
      routes: [
        { name: "Chats" },
        { name: screen as string, params },
      ],
    })
  } catch (error) {
    captureError(
      new NavigationError({
        error,
        additionalMessage: "Error navigating with reset",
      }),
    )
  }
}

export const getSchemedURLFromUniversalURL = (url: string) => {
  // Handling universal links by saving a schemed URI
  for (const prefix of config.app.universalLinks) {
    if (url.startsWith(prefix)) {
      return Linking.createURL(url.replace(prefix, ""))
    }
  }
  return url
}

const isDMLink = (url: string) => {
  for (const prefix of config.app.universalLinks) {
    if (url.startsWith(prefix)) {
      const path = url.slice(prefix.length)
      if (path.toLowerCase().startsWith("dm/")) {
        return true
      }
    }
  }
  return false
}

const isGroupLink = (url: string) => {
  for (const prefix of config.app.universalLinks) {
    if (url.startsWith(prefix)) {
      const path = url.slice(prefix.length)
      if (path.toLowerCase().startsWith("group/")) {
        return true
      }
    }
  }
  return false
}

const originalOpenURL = RNLinking.openURL.bind(RNLinking)
RNLinking.openURL = (url: string) => {
  logger.debug("[Navigation] Processing URL:", url)

  try {
    if (isDMLink(url)) {
      logger.debug("[Navigation] Handling DM link")
      return originalOpenURL(getSchemedURLFromUniversalURL(url))
    }
    if (isGroupLink(url)) {
      logger.debug("[Navigation] Handling group link")
      return originalOpenURL(getSchemedURLFromUniversalURL(url))
    }
    logger.debug("[Navigation] Handling default link")
    return originalOpenURL(url)
  } catch (error) {
    captureError(
      new NavigationError({
        error,
        additionalMessage: "Error processing URL",
      }),
    )
    return Promise.reject(error)
  }
}

export function getCurrentRoute() {
  return navigationRef.getCurrentRoute()
}
