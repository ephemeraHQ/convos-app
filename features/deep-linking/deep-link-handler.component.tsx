import { useCallback, useEffect } from "react"
import { Linking } from "react-native"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { useAppStateStore } from "@/stores/use-app-state-store"
import { logger } from "@/utils/logger/logger"
import { useConversationDeepLinkHandler } from "./conversation-navigator"
import { parseURL } from "./link-parser"

type IDeepLinkPattern = {
  pattern: string
  handler: (args: { 
    params: Record<string, string | undefined>
    handleConversationDeepLink: (args: { inboxId: IXmtpInboxId; composerTextPrefill?: string }) => Promise<void>
  }) => Promise<void>
}

const deepLinkPatterns: IDeepLinkPattern[] = [
  {
    pattern: "dm/:inboxId",
    handler: async ({ params, handleConversationDeepLink }) => {
      const inboxId = params.inboxId as IXmtpInboxId
      await handleConversationDeepLink({ 
        inboxId, 
        composerTextPrefill: params.composerTextPrefill 
      })
    },
  },
  {
    pattern: "group/:groupId",
    handler: async () => {
      // TODO
      logger.info("Group deep link handler not implemented yet")
    },
  },
  {
    pattern: "group-invite/:inviteId",
    handler: async () => {
      // TODO
      logger.info("Group invite deep link handler not implemented yet")
    },
  },
]

/**
 * Component that handles deep links for the app
 * This should be included at the app root to handle incoming links
 */
export function DeepLinkHandler() {
  const { currentState } = useAppStateStore.getState()
  const { handleConversationDeepLink } = useConversationDeepLinkHandler()

  /**
   * Handle a URL by parsing it and routing to the appropriate handler
   */
  const handleUrl = useCallback(
    async (url: string) => {
      logger.info(`Handling deep link URL: ${url}`)
      const { segments, params } = parseURL(url)
      logger.info(`Parsed segments: ${JSON.stringify(segments)}`)
      logger.info(`Parsed params: ${JSON.stringify(params)}`)

      for (const { pattern, handler } of deepLinkPatterns) {
        const patternSegments = pattern.split("/")
        if (patternSegments.length !== segments.length) continue

        const extractedParams: Record<string, string> = {}
        let matches = true

        for (let i = 0; i < patternSegments.length; i++) {
          const patternPart = patternSegments[i]
          const pathPart = segments[i]

          if (patternPart.startsWith(":")) {
            extractedParams[patternPart.slice(1)] = pathPart
          } else if (patternPart !== pathPart) {
            matches = false
            break
          }
        }

        if (matches) {
          logger.info(`Found matching pattern: ${pattern}`)
          logger.info(`Extracted params: ${JSON.stringify(extractedParams)}`)
          await handler({ 
            params: { ...extractedParams, composerTextPrefill: params.composerTextPrefill }, 
            handleConversationDeepLink 
          })
          return
        }
      }

      logger.info(`No matching pattern found for URL: ${url}`)
    },
    [handleConversationDeepLink],
  )

  // Handle initial URL when the app is first launched
  useEffect(() => {
    const getInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          logger.info(`App launched from deep link: ${initialUrl}`)
          handleUrl(initialUrl)
        }
      } catch (error) {
        logger.warn(`Error getting initial URL: ${error}`)
      }
    }

    getInitialURL()
  }, [handleUrl])

  // Listen for URL events when the app is running
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      logger.info(`Received deep link while running: ${url}`)
      handleUrl(url)
    })

    return () => {
      subscription.remove()
    }
  }, [handleUrl, currentState])

  // This is a utility component with no UI
  return null
}
