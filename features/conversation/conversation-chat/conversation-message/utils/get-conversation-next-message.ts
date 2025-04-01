import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getAllConversationMessageInInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getConversationNextMessage(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { messageId, xmtpConversationId } = args
  const currentSender = getSafeCurrentSender()
  const messages = getAllConversationMessageInInfiniteQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })
  if (!messages?.ids.includes(messageId)) {
    return undefined
  }
  const currentIndex = messages.ids.indexOf(messageId)
  const nextMessageId = messages.ids[currentIndex + 1]
  return nextMessageId ? messages.byId[nextMessageId] : undefined
}
