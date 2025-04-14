import { useQueries } from "@tanstack/react-query"
import { useCallback } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"

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

  const lastMessageIdQueries = useQueries({
    // @ts-ignore queries doesn't work great with infiniteQueryOptions
    queries: conversationIds.map((conversationId) => {
      const queryOptions = getConversationMessagesInfiniteQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useConversationListConversations",
      })

      return {
        ...queryOptions,
        select: (data: IConversationMessagesInfiniteQueryData) => {
          return data.pages[0]?.messageIds[0]
        },
      }
    }),
  })

  const lastMessageQueries = useQueries({
    queries: lastMessageIdQueries.map((query) => ({
      ...getConversationMessageQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId: query.data as IXmtpMessageId | undefined,
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

  // Process and sort conversations in a single pass
  const sortedConversationIds = conversationIds.reduce<IXmtpConversationId[]>(
    (validIds, conversationId, index) => {
      const metadataQuery = conversationMetadataQueries[index]
      const conversation = getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })
      const metadata = metadataQuery.data
      const lastMessage = lastMessageQueries[index].data

      // Skip if conversation doesn't meet criteria
      if (
        !conversation ||
        !isConversationAllowed(conversation) ||
        metadata?.pinned ||
        metadata?.deleted ||
        // Only block if metadata hasn't been fetched yet
        (metadataQuery.isLoading && !metadataQuery.data && !metadataQuery.isFetched)
      ) {
        return validIds
      }

      // Insert conversation ID in sorted order based on timestamp
      const timestamp = lastMessage?.sentNs ?? 0
      const insertIndex = validIds.findIndex((id) => {
        const existingTimestamp = lastMessageQueries[conversationIds.indexOf(id)].data?.sentNs ?? 0
        return timestamp > existingTimestamp
      })

      if (insertIndex === -1) {
        validIds.push(conversationId)
      } else {
        validIds.splice(insertIndex, 0, conversationId)
      }

      return validIds
    },
    [],
  )

  const handleRefetch = useCallback(() => {
    refetchConversations().catch(captureError)
    lastMessageIdQueries.forEach((query) => {
      query.refetch().catch(captureError)
    })
    conversationMetadataQueries.forEach((query) => {
      query.refetch().catch(captureError)
    })
    lastMessageQueries.forEach((query) => {
      query.refetch().catch(captureError)
    })
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
  }, [conversationMetadataQueries, lastMessageIdQueries, lastMessageQueries, refetchConversations])

  const hasAnyLastMessageLoading = lastMessageQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const hasAnyLastMessageIdLoading = lastMessageIdQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const hasAnyMetadataLoading = conversationMetadataQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const isLoading =
    isLoadingConversations ||
    hasAnyMetadataLoading ||
    hasAnyLastMessageLoading ||
    hasAnyLastMessageIdLoading

  return {
    data: sortedConversationIds,
    refetch: handleRefetch,
    isLoading,
  }
}
