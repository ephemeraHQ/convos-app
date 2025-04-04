import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
  mergeInfiniteQueryPages,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useConversationMessageReactions(xmtpMessageId: IXmtpMessageId) {
  const currentSender = getSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const selectFn = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessages = mergeInfiniteQueryPages(data)
      return allMessages?.reactions[xmtpMessageId]
    },
    [xmtpMessageId],
  )

  const { data: reactions } = useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "useConversationMessageReactions",
    }),
    select: selectFn,
  })

  // TODO: Add another fallback query to fetch single message reactions. Coming in the SDK later
  return {
    bySender: reactions?.bySender || {},
    byReactionContent: reactions?.byReactionContent || {},
  }
}
