import { useNavigation } from "@react-navigation/native"
import { useCallback } from "react"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { findConversationByInboxIds } from "@/features/conversation/utils/find-conversations-by-inbox-ids"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"

/**
 * Custom hook to handle conversation deep links
 * This is used by the DeepLinkHandler component to navigate to conversations from deep links
 */
export function useConversationDeepLinkHandler() {
  const navigation = useNavigation()

  /**
   * Process an inbox ID from a deep link and navigate to the appropriate conversation
   * @param inboxId The inbox ID from the deep link
   * @param composerTextPrefill Optional text to prefill in the composer
   */
  const handleConversationDeepLink = useCallback(
    async (inboxId: IXmtpInboxId, composerTextPrefill?: string) => {
      if (!inboxId) {
        logger.warn("Cannot handle conversation deep link - missing inboxId")
        return
      }

      try {
        logger.info(
          `Handling conversation deep link for inboxId: ${inboxId}${composerTextPrefill ? " with prefill text" : ""}`,
        )

        const state = useMultiInboxStore.getState()
        const activeInboxId = state.currentSender?.inboxId

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
          logger.info(`Found existing conversation with ID: ${conversation.xmtpId}`)

          navigation.navigate("Conversation", {
            xmtpConversationId: conversation.xmtpId as IXmtpConversationId,
            isNew: false,
            composerTextPrefill,
          })
        } else {
          logger.info(
            `No existing conversation found with inboxId: ${inboxId}, creating new conversation`,
          )

          navigation.navigate("Conversation", {
            searchSelectedUserInboxIds: [inboxId],
            isNew: true,
            composerTextPrefill,
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
    [navigation],
  )

  return { handleConversationDeepLink }
}

/**
 * Global function to process a new deep link that uses the ConversationScreenConfig format
 * This function is called by the navigation library when it receives a deep link
 */
export function processConversationDeepLink(
  params: Record<string, string | undefined>,
): Promise<boolean> {
  return new Promise(async (resolve) => {
    const { inboxId, composerTextPrefill } = params

    if (!inboxId) {
      logger.warn("Cannot process conversation deep link - missing inboxId")
      resolve(false)
      return
    }

    try {
      logger.info(
        `Processing Conversation deep link via navigation for inboxId: ${inboxId}${composerTextPrefill ? " with prefill text" : ""}`,
      )

      const state = useMultiInboxStore.getState()
      const activeInboxId = state.currentSender?.inboxId

      if (!activeInboxId) {
        throw new GenericError({
          error: new Error("No active inbox"),
          additionalMessage: "Cannot check conversation existence - no active inbox",
        })
      }

      const conversation = await findConversationByInboxIds({
        inboxIds: [inboxId as IXmtpInboxId],
        clientInboxId: activeInboxId,
      })

      if (conversation) {
        logger.info(`Navigation found existing conversation with ID: ${conversation.xmtpId}`)
        resolve(true)
        return
      }

      logger.info(
        `No existing conversation found with inboxId: ${inboxId}, navigation will create a new conversation`,
      )
      resolve(true)
    } catch (error) {
      logger.error(`Error in processConversationDeepLink: ${error}`)
      resolve(true)
    }
  })
}
