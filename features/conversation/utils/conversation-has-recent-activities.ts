import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { getConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getHoursSinceTimestamp } from "@/utils/date"

export function conversationHasRecentActivities(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpConversationId, clientInboxId } = args

  const messages = getConversationMessagesInfiniteQueryData({
    clientInboxId,
    xmtpConversationId,
  })?.pages[0]?.messageIds

  const lastMessageId = messages?.[0]

  const lastMessage = getConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId: lastMessageId,
  })

  if (!lastMessage) {
    return true
  }

  const hoursSinceLastMessage = getHoursSinceTimestamp(lastMessage?.sentMs ?? 0)

  return hoursSinceLastMessage <= 48 // 2 days
}
