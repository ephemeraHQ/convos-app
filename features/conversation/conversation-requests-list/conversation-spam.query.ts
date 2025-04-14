import { queryOptions } from "@tanstack/react-query"
import { ensureConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { ensureConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ensureMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { getMessageSpamScore } from "@/features/conversation/conversation-requests-list/utils/get-message-spam-score"
import { ensureConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}

export function getConversationSpamQueryOptions(args: IArgs) {
  const { xmtpConversationId, clientInboxId } = args

  return queryOptions({
    enabled: !!xmtpConversationId && !!clientInboxId,
    queryKey: getReactQueryKey({
      baseStr: "is-spam",
      xmtpConversationId,
      clientInboxId,
    }),
    queryFn: async () => {
      const conversation = await ensureConversationQueryData({
        clientInboxId,
        xmtpConversationId,
        caller: "getConversationSpamQueryOptions",
      })

      if (!conversation) {
        throw new Error("Conversation not found")
      }

      const messageQueryData = await ensureConversationMessagesInfiniteQueryData({
        clientInboxId,
        xmtpConversationId,
        caller: "getConversationSpamQueryOptions",
      })
      const firstMessageId = messageQueryData.pages[0]?.messageIds[0]

      // For now to make it easier, no last message isn't spam
      if (!firstMessageId) {
        return false
      }

      const lastMessage = await ensureConversationMessageQueryData({
        clientInboxId,
        xmtpMessageId: firstMessageId,
        caller: "getConversationSpamQueryOptions",
      })

      // For now to make it easier, no last message isn't spam
      if (!lastMessage) {
        return false
      }

      const messageText = await ensureMessageContentStringValue(lastMessage)

      if (!messageText) {
        throw new Error("No message text found")
      }

      const spamScore = await getMessageSpamScore({
        message: lastMessage,
      })

      const isSpam = spamScore !== 0

      return isSpam
    },
  })
}
