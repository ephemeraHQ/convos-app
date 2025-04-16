import { useIsFocused } from "@react-navigation/native"
import { InfiniteQueryObserver } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isReactionMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryData,
  getConversationMessagesInfiniteQueryOptions,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { getConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { conversationIsUnreadForInboxId } from "@/features/conversation/utils/conversation-is-unread-by-current-account"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { Haptics } from "@/utils/haptics"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

/**
 * Add to do this weird useState, useEffect and InfiniteQueryObserver logic because react-query doesn't support useInfiniteQueries correctly
 */
export function useConversationLastMessageIds(args: { conversationIds: IXmtpConversationId[] }) {
  const { conversationIds } = args

  const currentSender = useSafeCurrentSender()
  const isFocused = useIsFocused()
  const prevMessageIdsRef = useRef<Record<IXmtpConversationId, IXmtpMessageId | undefined>>({})
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
      prevMessageIdsRef.current[conversationId] = firstMessageId
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
        const prevMessageId = prevMessageIdsRef.current[conversationId]

        // Haptic for new message when we are in the conversation list screen and the conversation was unread
        const conversationMetadata = getConversationMetadataQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
        })
        const lastMessage = getConversationMessageQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpMessageId: lastMessageId,
        })
        if (
          isFocused &&
          prevMessageId &&
          lastMessageId &&
          prevMessageId !== lastMessageId &&
          conversationMetadata &&
          conversationIsUnreadForInboxId({
            lastMessageSentAt: lastMessage?.sentMs,
            lastMessageSenderInboxId: lastMessage?.senderInboxId,
            consumerInboxId: currentSender.inboxId,
            markedAsUnread: !!conversationMetadata.unread,
            readUntil: conversationMetadata.readUntil
              ? new Date(conversationMetadata.readUntil).getTime()
              : null,
          })
        ) {
          Haptics.softImpactAsync()
        }

        // Update the ref with current message ID
        if (lastMessageId) {
          prevMessageIdsRef.current[conversationId] = lastMessageId
        }

        setLastMessageIdForConversationMap((prev) => ({
          ...prev,
          [conversationId]: lastMessageId,
        }))
      })

      lastMessageIdQueryObserversRef.current[conversationId] = unsubscribe
    })
  }, [conversationIds, currentSender.inboxId, isFocused, setLastMessageIdForConversationMap])

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
