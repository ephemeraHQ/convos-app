import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getAllConversationMessageInInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getCurrentUserAlreadyReactedOnMessage(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
  emoji: string | undefined // Specific emoji or just reacted in general
}) {
  const { messageId, xmtpConversationId, emoji } = args

  const currentSender = getSafeCurrentSender()

  const messages = getAllConversationMessageInInfiniteQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const reactions = messages?.reactions[messageId]
  const bySender = reactions?.bySender

  return bySender?.[currentSender.inboxId!]?.some(
    (reaction) => !emoji || reaction.content === emoji,
  )
}
