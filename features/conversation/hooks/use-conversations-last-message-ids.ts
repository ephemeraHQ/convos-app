import { useCallback, useEffect, useState } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryData,
  getConversationMessagesInfiniteQueryObserver,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

/**
 * Add to do this weird useState, useEffect and InfiniteQueryObserver logic because react-query doesn't support useInfiniteQueries correctly
 */
export function useConversationLastMessageIds(args: { conversationIds: IXmtpConversationId[] }) {
  const { conversationIds } = args

  const currentSender = useSafeCurrentSender()

  const getInitialLastMessageIds = useCallback(() => {
    const initialData: Record<IXmtpConversationId, IXmtpMessageId | undefined> = {}
    for (const conversationId of conversationIds) {
      const firstMessageId = getConversationMessagesInfiniteQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })?.pages[0]?.messageIds?.[0]
      initialData[conversationId] = firstMessageId
    }
    return initialData
  }, [conversationIds, currentSender.inboxId])

  const [lastMessageIdForConversationMap, setLastMessageIdForConversationMap] =
    useState<Record<IXmtpConversationId, IXmtpMessageId | undefined>>(getInitialLastMessageIds)

  useEffect(() => {
    const unsubscribers: Array<() => void> = []

    conversationIds.forEach((conversationId) => {
      const observer = getConversationMessagesInfiniteQueryObserver({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
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

      unsubscribers.push(unsubscribe)
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }, [conversationIds, currentSender.inboxId, setLastMessageIdForConversationMap])

  const refetch = useCallback(() => {
    setLastMessageIdForConversationMap(getInitialLastMessageIds())
  }, [getInitialLastMessageIds])

  return {
    lastMessageIdByConversationId: lastMessageIdForConversationMap,
    isLoading: false,
    refetch,
  }
}
