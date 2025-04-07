import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isAnActualMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useIsLatestMessageByCurrentUser(messageIdToCompare: IXmtpMessageId) {
  const currentSender = getSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const selectFn = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessageIds = data.pages.flatMap((page) => page.messageIds)
      const latestMessageIdByCurrentUser = allMessageIds?.find((messageId) => {
        const message = getConversationMessageQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpMessageId: messageId,
        })

        return (
          message && isAnActualMessage(message) && message.senderInboxId === currentSender.inboxId
        )
      })

      return latestMessageIdByCurrentUser === messageIdToCompare
    },
    [messageIdToCompare, currentSender.inboxId],
  )

  const { data: latestMessageIdByCurrentUser } = useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "useConversationMessageReactions",
    }),
    select: selectFn,
  })

  return latestMessageIdByCurrentUser
}
