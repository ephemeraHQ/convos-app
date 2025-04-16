import { InfiniteQueryObserver } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryData,
  getConversationMessagesInfiniteQueryOptions,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

/**
 * Add to do this weird useState, useEffect and InfiniteQueryObserver logic because react-query doesn't support useInfiniteQueries correctly
 */
export function useConversationLastMessageIds(args: { conversationIds: IXmtpConversationId[] }) {
  const { conversationIds } = args

  const currentSender = useSafeCurrentSender()

  const lastMessageIdQueryObserversRef = useRef<Record<IXmtpConversationId, () => void>>({})

  const [lastMessageIdForConversationMap, setLastMessageIdForConversationMap] = useState<
    Record<IXmtpConversationId, IXmtpMessageId | undefined>
  >(() => {
    const initialData: Record<IXmtpConversationId, IXmtpMessageId | undefined> = {}
    for (const conversationId of conversationIds) {
      const firstMessageId = getConversationMessagesInfiniteQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })?.pages[0]?.messageIds?.[0]
      initialData[conversationId] = firstMessageId
    }
    return initialData
  })

  useEffect(() => {
    conversationIds.forEach((conversationId) => {
      // Don't create a new observer if one already exists
      if (lastMessageIdQueryObserversRef.current[conversationId]) {
        return
      }

      const observer = new InfiniteQueryObserver(reactQueryClient, {
        ...getConversationMessagesInfiniteQueryOptions({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          caller: "useConversationListConversations",
        }),
      })

      const unsubscribe = observer.subscribe(({ data }) => {
        const lastMessageId = data?.pages[0]?.messageIds?.find((messageId) => {
          const message = getConversationMessageQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpMessageId: messageId,
          })
          return message && !isReactionMessage(message)
        })
        setLastMessageIdForConversationMap((prev) => ({
          ...prev,
          [conversationId]: lastMessageId,
        }))
      })

      lastMessageIdQueryObserversRef.current[conversationId] = unsubscribe
    })
  }, [conversationIds, currentSender.inboxId, setLastMessageIdForConversationMap])

  // Cleanup
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(lastMessageIdQueryObserversRef.current).forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }, [])

  return {
    lastMessageIdForConversationMap,
  }
}
