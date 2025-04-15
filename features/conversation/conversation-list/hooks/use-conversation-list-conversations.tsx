import { InfiniteQueryObserver, useQueries } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  getConversationMessagesInfiniteQueryData,
  getConversationMessagesInfiniteQueryOptions,
  refetchInfiniteConversationMessages,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { ObjectTyped } from "@/utils/object-typed"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

const lastMessageIdQueryObservers: Record<IXmtpConversationId, () => void> = {}

export const useConversationListConversations = () => {
  const currentSender = useSafeCurrentSender()

  const {
    data: conversationIds = [],
    refetch: refetchConversations,
    isLoading: isLoadingConversations,
  } = useAllowedConsentConversationsQuery({
    clientInboxId: currentSender.inboxId,
    caller: "useConversationListConversations",
  })

  /**
   * Add to do this weird useState, useEffect and InfiniteQueryObserver logic because react-query doesn't support useInfiniteQueries correctly
   */
  const [lastMessageIdForConversationMap, setLastMessageIdForConversationMap] = useState<
    Record<IXmtpConversationId, IXmtpMessageId | undefined>
  >(() => {
    const record: Record<IXmtpConversationId, IXmtpMessageId | undefined> = {}
    for (const conversationId of conversationIds) {
      const firstMessageId = getConversationMessagesInfiniteQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })?.pages[0]?.messageIds[0]
      record[conversationId] = firstMessageId
    }
    return record
  })

  useEffect(() => {
    conversationIds.forEach((conversationId) => {
      // Don't create a new observer if one already exists
      if (lastMessageIdQueryObservers[conversationId]) {
        return
      }

      const observer = new InfiniteQueryObserver(
        reactQueryClient,
        getConversationMessagesInfiniteQueryOptions({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          caller: "useConversationListConversations",
        }),
      )

      const unsubscribe = observer.subscribe(({ data }) => {
        const lastMessageId = data?.pages[0]?.messageIds[0]

        setLastMessageIdForConversationMap((prev) => ({
          ...prev,
          [conversationId]: lastMessageId,
        }))
      })

      lastMessageIdQueryObservers[conversationId] = unsubscribe
    })
  }, [conversationIds, currentSender.inboxId, setLastMessageIdForConversationMap])

  // Cleanup
  useEffect(() => {
    return () => {
      ObjectTyped.entries(lastMessageIdQueryObservers).forEach(([conversationId, unsubscribe]) => {
        unsubscribe()
        delete lastMessageIdQueryObservers[conversationId]
      })
    }
  }, [])

  const lastMessageIds = Object.values(lastMessageIdForConversationMap)

  const lastMessageQueries = useQueries({
    queries: lastMessageIds.map((messageId) => ({
      ...getConversationMessageQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId: messageId,
        caller: "useConversationListConversations",
      }),
    })),
  })

  const conversationMetadataQueries = useQueries({
    queries: conversationIds.map((conversationId) =>
      getConversationMetadataQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      }),
    ),
  })

  // Single pass to process conversations
  const validConversationIds = conversationIds.reduce(
    (acc, conversationId, index) => {
      const conversationMetadataQuery = conversationMetadataQueries[index]
      const conversation = getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })
      const metadata = conversationMetadataQuery.data

      // Skip conversations that don't meet criteria
      if (
        !conversation ||
        !isConversationAllowed(conversation) ||
        metadata?.pinned ||
        metadata?.deleted ||
        (conversationMetadataQuery.isLoading && !conversationMetadataQuery.isFetched)
      ) {
        return acc
      }

      // Get the last message for valid conversations
      const messageId = lastMessageIdForConversationMap[conversationId]
      const messageIndex = lastMessageIds.findIndex((id) => id === messageId)
      const lastMessageQuery = messageIndex >= 0 ? lastMessageQueries[messageIndex] : undefined
      const lastMessage = lastMessageQuery?.data
      const timestamp = lastMessage?.sentMs ?? 0

      // Add to accumulator with timestamp for sorting
      acc.push({
        conversationId,
        timestamp,
      })

      return acc
    },
    [] as Array<{ conversationId: IXmtpConversationId; timestamp: number }>,
  )

  // Sort in descending order (newest first)
  validConversationIds.sort((a, b) => b.timestamp - a.timestamp)

  // Extract just the conversation IDs for the final result
  const result = validConversationIds.map((item) => item.conversationId)

  const handleRefetch = useCallback(() => {
    // Refetch all conversations
    refetchConversations().catch(captureError)
    // Refetch all metadata for all conversations
    conversationMetadataQueries.forEach((query) => {
      query.refetch().catch(captureError)
    })
    // Refetch all messages for all conversations
    for (const conversationId of conversationIds) {
      refetchInfiniteConversationMessages({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useConversationListConversations",
      }).catch(captureError)
    }
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
  }, [conversationIds, currentSender.inboxId, conversationMetadataQueries, refetchConversations])

  const hasAnyLastMessageLoading = lastMessageQueries.some(
    (query) => query.isLoading && !query.data,
  )
  // No more lastMessageIdQueries
  const hasAnyLastMessageIdLoading = false
  const hasAnyMetadataLoading = conversationMetadataQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const isLoading =
    isLoadingConversations ||
    hasAnyMetadataLoading ||
    hasAnyLastMessageLoading ||
    hasAnyLastMessageIdLoading

  return {
    data: result,
    refetch: handleRefetch,
    isLoading,
  }
}
