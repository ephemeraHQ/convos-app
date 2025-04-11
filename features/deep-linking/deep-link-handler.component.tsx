import { useEffect } from "react"
import { Linking } from "react-native"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { deepLinkLogger } from "@/utils/logger/logger"
import { parseURL } from "./link-parser"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { navigate } from "@/navigation/navigation.utils"
import { findConversationByInboxIds } from "@/features/conversation/utils/find-conversations-by-inbox-ids"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"

type IDeepLinkPattern = {
  pattern: string
  handler: (params: Record<string, string | undefined>) => Promise<void>
}

const deepLinkPatterns: IDeepLinkPattern[] = [
  {
    pattern: "dm/:inboxId",
    handler: async (params) => {
      const inboxId = params.inboxId as IXmtpInboxId

      deepLinkLogger.info(`Processing conversation for inboxId: ${inboxId}`)

      if (!inboxId) {
        throw new GenericError({
          error: new Error("Missing inboxId"),
          additionalMessage: "Cannot handle conversation deep link - missing inboxId",
        })
      }

      try {
        deepLinkLogger.info(
          `Processing conversation for inboxId: ${inboxId}${
            params.composerTextPrefill ? " with prefill text" : ""
          }`,
        )

        const state = useMultiInboxStore.getState()
        const activeInboxId = state.currentSender?.inboxId

        deepLinkLogger.info(`Current active inboxId: ${activeInboxId}`)

        if (!activeInboxId) {
          throw new GenericError({
            error: new Error("No active inbox"),
            additionalMessage: "Cannot check conversation existence - no active inbox",
          })
        }

        const conversation = await findConversationByInboxIds({
          inboxIds: [inboxId],
          clientInboxId: activeInboxId,
        })

        if (conversation) {
          deepLinkLogger.info(`Found existing conversation with ID: ${conversation.xmtpId}`)

          await navigate("Conversation", {
            xmtpConversationId: conversation.xmtpId,
            isNew: false,
            composerTextPrefill: params.composerTextPrefill,
          })
        } else {
          deepLinkLogger.info(
            `No existing conversation found with inboxId: ${inboxId}, creating new conversation`,
          )

          await navigate("Conversation", {
            searchSelectedUserInboxIds: [inboxId],
            isNew: true,
            composerTextPrefill: params.composerTextPrefill,
          })
        }
      } catch (error) {
        captureError(
          new GenericError({
            error,
            additionalMessage: `Failed to handle conversation deep link for inboxId: ${inboxId}`,
            extra: { inboxId },
          }),
        )
      }
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

function processDeepLink(url: string) {
  const { status: authStatus } = useAuthenticationStore.getState()

  if (authStatus !== "signedIn") {
    deepLinkLogger.info(`Skipping deep link processing - not authenticated (auth: ${authStatus})`)
    return
  }

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
      handler({ ...extractedParams, composerTextPrefill: params.composerTextPrefill })
        .catch((error) => {
          captureError(
            new GenericError({
              error,
              additionalMessage: `Failed to handle deep link pattern: ${pattern}`,
              extra: { pattern, params: extractedParams },
            })
          )
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
  const authStatus = useAuthenticationStore((state) => state.status)

  useEffect(() => {
    // Handle initial URL when the app is first launched
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          deepLinkLogger.info(`App launched from deep link: ${url}`)
          if (authStatus === "signedIn") {
            processDeepLink(url)
          } else {
            deepLinkLogger.info(`Waiting for auth before processing deep link`)
          }
        }
      })
      .catch((error) => {
        captureError(
          new GenericError({
            error,
            additionalMessage: "Failed to get initial deep link URL",
          })
        )
      })

    // Listen for URL events when the app is running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      deepLinkLogger.info(`Received deep link while running: ${url}`)
      processDeepLink(url)
    })

    return () => subscription.remove()
  }, [authStatus])

  return null
}
