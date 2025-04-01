import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
  mergeInfiniteQueryPages,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useConversationMessageById(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { messageId, xmtpConversationId } = args
  const currentSender = useSafeCurrentSender()

  // Use select to extract only the message we need from infinite query results
  const selectMessageFromConversation = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessages = mergeInfiniteQueryPages(data)
      return allMessages?.byId[messageId] || null
    },
    [messageId],
  )

  const { data: cachedMessage } = useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "useConversationMessageById",
    }),
    select: selectMessageFromConversation,
  })

  const defaultQueryOptions = getConversationMessageQueryOptions({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: messageId,
  })

  // Only fetch single message if not in conversation cache
  const { data: message, isPending: isLoadingMessage } = useQuery({
    ...defaultQueryOptions,
    enabled: defaultQueryOptions.enabled && !cachedMessage,
  })

  return {
    message: message ?? cachedMessage,
    isLoading: !cachedMessage && isLoadingMessage,
  }
}
