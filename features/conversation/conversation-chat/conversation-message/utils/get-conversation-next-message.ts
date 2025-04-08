import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { getAllConversationMessageInInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getConversationNextMessage(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { messageId, xmtpConversationId } = args

  const currentSender = getSafeCurrentSender()

  const messageIds =
    getAllConversationMessageInInfiniteQueryData({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
    }) || []

  if (!messageIds.includes(messageId)) {
    return undefined
  }

  const currentIndex = messageIds.indexOf(messageId)
  const nextMessageId = messageIds[currentIndex - 1]

  if (!nextMessageId) {
    return null
  }

  return getConversationMessageQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: nextMessageId,
  })
}
