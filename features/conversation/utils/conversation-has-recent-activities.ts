import { InfiniteData } from "@tanstack/react-query"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { getHoursSinceTimestamp } from "@/utils/date"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

// Define the type for message IDs page
type IMessageIdsPage = {
  messageIds: IXmtpMessageId[]
  nextCursorNs: number | null
  prevCursorNs: number | null
}

export function conversationHasRecentActivities(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpConversationId, clientInboxId } = args

  // Access query data directly using reactQueryClient instead of importing the function
  const queryKey = getReactQueryKey({
    baseStr: "conversation-messages-infinite",
    clientInboxId,
    xmtpConversationId,
  })

  const data = reactQueryClient.getQueryData<InfiniteData<IMessageIdsPage>>(queryKey)
  const messages = data?.pages?.[0]?.messageIds

  const lastMessageId = messages?.[0]

  const lastMessage = getConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId: lastMessageId,
    xmtpConversationId,
  })

  if (!lastMessage) {
    return true
  }

  const hoursSinceLastMessage = getHoursSinceTimestamp(lastMessage?.sentMs ?? 0)

  return hoursSinceLastMessage <= 48 // 2 days
}
