import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { findConversationByInboxIds } from "@/features/conversation/utils/find-conversations-by-inbox-ids"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { logger } from "@/utils/logger/logger"
import { XMTPError } from "@/utils/error"

export async function checkConversationExists(inboxId: IXmtpInboxId) {
  try {
    // Get active user's inbox ID
    const state = useMultiInboxStore.getState()
    const activeInboxId = state.currentSender?.inboxId

    if (!activeInboxId) {
      throw new XMTPError({
        error: new Error("No active inbox"),
        additionalMessage: "Cannot check conversation existence - no active inbox",
      })
    }

    // Try to find an existing conversation
    const conversation = await findConversationByInboxIds({
      inboxIds: [inboxId],
      clientInboxId: activeInboxId,
    })

    if (conversation) {
      logger.info(`Found existing conversation with ID: ${conversation.xmtpId}`)
      return {
        exists: true,
        conversationId: conversation.xmtpId as IXmtpConversationId,
      }
    }

    return { exists: false }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to check conversation existence",
    })
  }
}
