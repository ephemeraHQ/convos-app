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
export const navigationRef = createNavigationContainerRef<NavigationParamList>()

export function waitUntilNavigationReady(args: { timeoutMs?: number } = {}) {
  return waitUntilPromise({
    checkFn: () => navigationRef.isReady(),
    intervalMs: 100,
    timeoutMs: args.timeoutMs,
  })
}

/**
 * Ensures the navigation ref is ready before proceeding
 */
export async function ensureNavigationReady(timeoutMs = 10000): Promise<void> {
  if (!navigationRef || !navigationRef.isReady()) {
    await waitUntilNavigationReady({ timeoutMs })
  }
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

    await ensureNavigationReady()

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
 * Resets navigation to home screen and then navigates to the specified screen
 * Use this for deep links to ensure we navigate from a consistent starting point
 *
 * Example:
 *   When a user taps a message notification or a conversation link from outside the app,
 *   we want to reset their navigation stack rather than adding the conversation screen
 *   on top of whatever screens they had open before. This ensures a consistent experience
 *   where pressing "back" from a deep-linked conversation always returns to Chats.
 */
export async function navigateFromHome<S extends keyof NavigationParamList>(
  screen: S,
  params?: NavigationParamList[S],
) {
  try {
    await ensureNavigationReady()

    logger.debug(
      `[Navigation] Navigating from home to ${screen} ${params ? JSON.stringify(params) : ""}`,
    )

    // If we're navigating to the home screen, just do a simple reset
    if (screen === "Chats") {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: screen, params }],
      })
      return
    }

    // For other screens, reset to home and then add our target screen
    navigationRef.resetRoot({
      index: 1, // Set index to 1 to focus on the new screen
      routes: [{ name: "Chats" }, { name: screen, params }],
    })
  } catch (error) {
    captureError(
      new NavigationError({
        error,
        additionalMessage: "Error navigating from home",
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

export function getCurrentRouteParams<T extends keyof NavigationParamList>():
  | NavigationParamList[T]
  | undefined {
  const currentRoute = navigationRef.getCurrentRoute()
  if (!currentRoute) return undefined
  return currentRoute.params as NavigationParamList[T]
}
