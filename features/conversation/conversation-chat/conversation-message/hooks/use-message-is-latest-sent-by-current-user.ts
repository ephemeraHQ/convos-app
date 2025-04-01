import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { isAnActualMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
  mergeInfiniteQueryPages,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useIsLatestMessageByCurrentUser(messageId: IXmtpMessageId) {
  const currentSender = getSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const selectFn = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessages = mergeInfiniteQueryPages(data)
      const latestMessageIdByCurrentUser = allMessages.ids?.find(
        (messageId) =>
          isAnActualMessage(allMessages.byId[messageId]) &&
          allMessages.byId[messageId].senderInboxId === currentSender.inboxId,
      )

      return latestMessageIdByCurrentUser === messageId
    },
    [messageId, currentSender.inboxId],
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
