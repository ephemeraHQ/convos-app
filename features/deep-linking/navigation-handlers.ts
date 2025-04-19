import { getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { navigateWithReset } from "@/navigation/navigation.utils"
import { logger } from "@/utils/logger/logger"
import { findConversationByInboxIds } from "@/features/conversation/utils/find-conversations-by-inbox-ids"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { useDeepLinkStore } from "./deep-link.store"

/**
 * Custom getStateFromPath function to handle deep links for the app
 * This is used by React Navigation's linking configuration to convert URLs to navigation state
 *
 * @param path The URL path to convert to navigation state
 * @param options Options for the getStateFromPath function
 * @returns A navigation state object based on the URL
 */
export const getStateFromPath = (
  path: string,
  options: Parameters<typeof defaultGetStateFromPath>[1],
) => {
  // First get the default state from React Navigation
  const state = defaultGetStateFromPath(path, options)

  // If we don't have a state, or the state doesn't contain routes, just return it as is
  if (!state || !state.routes || state.routes.length === 0) {
    return state
  }

  // Find the conversation route if it exists
  const conversationRoute = state.routes.find((route) => route.name === "Conversation")

  // If there's no conversation route, return the state unchanged
  if (!conversationRoute) {
    return state
  }

  // Type assertion for the params
  const params = conversationRoute.params as Record<string, unknown> | undefined

  // If we have an inboxId param, we need to handle it specially
  if (params && typeof params.inboxId === "string") {
    const inboxId = params.inboxId as IXmtpInboxId
    const composerTextPrefill =
      typeof params.composerTextPrefill === "string" ? params.composerTextPrefill : undefined

    // Construct the full URL for deduplication tracking
    const fullUrl = `${path}${composerTextPrefill ? `?composerTextPrefill=${composerTextPrefill}` : ""}`
    const deepLinkStore = useDeepLinkStore.getState()

    // Skip processing if this deep link was recently processed
    if (deepLinkStore.actions.hasProcessedRecentlyDeepLink(fullUrl)) {
      return state
    }

    // Mark this URL as processed
    deepLinkStore.actions.markDeepLinkAsProcessed(fullUrl)

    logger.info(
      `Deep link handler: Processing conversation for inboxId: ${inboxId}${
        composerTextPrefill ? ` with text: ${composerTextPrefill}` : ""
      }`,
    )

    // Clear any existing pending deep link
    useDeepLinkStore.getState().actions.clearPendingDeepLink()

    const storeState = useMultiInboxStore.getState()
    const activeInboxId = storeState.currentSender?.inboxId

    if (activeInboxId) {
      // We need to check if a conversation exists with this inboxId
      // Since we can't make this function async, we'll set up initial parameters
      // for a new conversation, and our deep link handler will update it if needed
      findConversationByInboxIds({
        inboxIds: [inboxId],
        clientInboxId: activeInboxId,
      })
        .then((conversation) => {
          if (conversation) {
            logger.info(
              `Deep link handler: Found existing conversation, navigating to: ${conversation.xmtpId}`,
            )
            navigateWithReset("Conversation", {
              xmtpConversationId: conversation.xmtpId,
              isNew: false,
              composerTextPrefill,
            })
          }
        })
        .catch((error) => {
          logger.error(`Deep link handler: Error checking conversation existence: ${error}`)
        })
    }

    // Initially set up parameters for a new conversation, but we'll override
    // this with the navigation call above if we find an existing conversation
    const updatedRoutes = state.routes.map((route) => {
      if (route.name === "Conversation") {
        return {
          ...route,
          params: {
            ...params,
            searchSelectedUserInboxIds: [inboxId],
            isNew: true,
            composerTextPrefill,
          },
        }
      }
      return route
    })

    return {
      ...state,
      routes: updatedRoutes,
    }
  }

  return state
}
