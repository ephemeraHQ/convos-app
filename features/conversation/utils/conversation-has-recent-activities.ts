import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getHoursSinceTimestamp } from "@/utils/date"

export function conversationHasRecentActivities(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpConversationId, clientInboxId } = args

  const conversation = getConversationQueryData({
    clientInboxId,
    xmtpConversationId,
  })

  if (!conversation) {
    return false
  }

  const lastMessage = conversation.lastMessage

  if (!lastMessage) {
    return false
  }

  const hoursSinceLastMessage = getHoursSinceTimestamp(lastMessage.sentMs)

  return hoursSinceLastMessage <= 2 // 2 hours
}
