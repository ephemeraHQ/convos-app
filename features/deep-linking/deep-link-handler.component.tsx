import { useCallback, useEffect } from "react"
import { Linking } from "react-native"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { useAppStateStore } from "@/stores/use-app-state-store"
import { deepLinkLogger } from "@/utils/logger/logger"
import { useConversationDeepLinkHandler } from "./conversation-navigator"
import { parseURL } from "./link-parser"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"

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
      deepLinkLogger.info("Group deep link handler not implemented yet")
    },
  },
  {
    pattern: "group-invite/:inviteId",
    handler: async () => {
      // TODO
      deepLinkLogger.info("Group invite deep link handler not implemented yet")
    },
  },
]

/**
 * Process a URL by parsing it and routing to the appropriate handler
 */
function processDeepLink(args: { 
  url: string
  handleConversationDeepLink: (args: { inboxId: IXmtpInboxId; composerTextPrefill?: string }) => Promise<void>
}) {
  const { url, handleConversationDeepLink } = args
  deepLinkLogger.info(`Processing deep link URL: ${url}`)

  const { segments, params } = parseURL(url)
  deepLinkLogger.info(`Parsed segments: ${JSON.stringify(segments)}`)
  deepLinkLogger.info(`Parsed params: ${JSON.stringify(params)}`)

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
      deepLinkLogger.info(`Found matching pattern: ${pattern}`)
      deepLinkLogger.info(`Extracted params: ${JSON.stringify(extractedParams)}`)
      handler({ 
        params: { ...extractedParams, composerTextPrefill: params.composerTextPrefill }, 
        handleConversationDeepLink 
      }).catch((error) => {
        deepLinkLogger.error(`Error handling deep link: ${error}`)
      })
      return
    }
  }

  deepLinkLogger.info(`No matching pattern found for URL: ${url}`)
}

/**
 * Component that handles deep links for the app
 * This should be included at the app root to handle incoming links
 */
export function DeepLinkHandler() {
  const { currentState } = useAppStateStore.getState()
  const { handleConversationDeepLink } = useConversationDeepLinkHandler()
  const authStatus = useAuthenticationStore((state) => state.status)

  const handleDeepLink = useCallback((url: string) => {
    if (currentState === "active" && authStatus === "signedIn") {
      processDeepLink({ url, handleConversationDeepLink })
    } else {
      deepLinkLogger.info(`Skipping deep link processing - app not ready (state: ${currentState}, auth: ${authStatus})`)
    }
  }, [currentState, authStatus, handleConversationDeepLink])

  useEffect(() => {
    // Handle initial URL when the app is first launched
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          deepLinkLogger.info(`App launched from deep link: ${url}`)
          handleDeepLink(url)
        }
      })
      .catch((error) => {
        deepLinkLogger.warn(`Error getting initial URL: ${error}`)
      })

    // Listen for URL events when the app is running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      deepLinkLogger.info(`Received deep link while running: ${url}`)
      handleDeepLink(url)
    })

    return () => subscription.remove()
  }, [handleDeepLink])

  return null
}
