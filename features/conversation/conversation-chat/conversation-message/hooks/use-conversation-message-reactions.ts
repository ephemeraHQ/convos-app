import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useConversationMessageReactions(xmtpMessageId: IXmtpMessageId) {
  const currentSender = getSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const selectFn = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessageIds = data.pages.flatMap((page) => page.messageIds)
      const messageIdIndex = allMessageIds.findIndex((id) => id === xmtpMessageId)

      if (messageIdIndex === -1) {
        return undefined
      }

      const message = getConversationMessageQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId,
      })

      if (!message) {
        return undefined
      }

      // todo: implement
      return false
    },
    [xmtpMessageId, currentSender.inboxId],
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
    bySender: {},
    byReactionContent: {},
  }
}
