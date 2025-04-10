import { useNavigation } from "@react-navigation/native"
import { useCallback } from "react"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { deepLinkLogger } from "@/utils/logger/logger"
import { findConversationByInboxIds } from "@/features/conversation/utils/find-conversations-by-inbox-ids"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"

/**
 * Custom hook to handle conversation deep links
 * This is used by the DeepLinkHandler component to navigate to conversations from deep links
 */
export function useConversationDeepLinkHandler() {
  const navigation = useNavigation()

  // Process an inbox ID from a deep link and navigate to the appropriate conversation
  const handleConversationDeepLink = useCallback(
    async (args: { inboxId: IXmtpInboxId; composerTextPrefill?: string }) => {
      const { inboxId, composerTextPrefill } = args

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
            composerTextPrefill ? " with prefill text" : ""
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

          navigation.navigate("Conversation", {
            xmtpConversationId: conversation.xmtpId,
            isNew: false,
            composerTextPrefill,
          })
        } else {
          deepLinkLogger.info(
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
