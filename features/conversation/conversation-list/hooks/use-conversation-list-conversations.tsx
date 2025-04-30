import { useQueries } from "@tanstack/react-query"
import { useCallback } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { refetchInfiniteConversationMessages } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useConversationLastMessageIds } from "@/features/conversation/hooks/use-conversations-last-message-ids"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
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

  const { refetch: refetchConversationLastMessageIds, lastMessageIdByConversationId } =
    useConversationLastMessageIds({
      conversationIds,
    })

  const lastMessageIds = Object.values(lastMessageIdByConversationId)

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
        caller: "useConversationListConversations",
      }),
    ),
  })

  let validConversationIds = conversationIds.reduce(
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
        conversationMetadataQuery.isLoading
      ) {
        return acc
      }

      // Get the last message for valid conversations
      const messageId = lastMessageIdByConversationId[conversationId]
      const lastMessageQuery = lastMessageQueries.find((query) => query.data?.xmtpId === messageId)
      const lastMessage = lastMessageQuery?.data
      // Use last message timestamp if available, otherwise use conversation created timestamp
      let timestamp = 0
      if (lastMessage) {
        timestamp = lastMessage.sentMs
      } else if (conversation?.createdAt) {
        timestamp = conversation.createdAt
      }

      // Add to accumulator with timestamp for sorting
      acc.push({
        conversationId,
        timestamp,
      })

      return acc
    },
    [] as Array<{ conversationId: IXmtpConversationId; timestamp: number }>,
  )

  // // Sort in descending order (newest first)
  validConversationIds = validConversationIds.sort((a, b) => {
    return b.timestamp - a.timestamp
  })

  const sortedValidConversationIds = validConversationIds.map((item) => item.conversationId)

  const handleRefetch = useCallback(
    () => {
      // Refetch all conversations
      refetchConversations().catch(captureError)
      // Refetch all metadata for all conversations
      // Not important enough to refetch
      // conversationMetadataQueries.forEach((query) => {
      //   query.refetch().catch(captureError)
      // })
      // Refetch all messages for all conversations
      for (const conversationId of conversationIds) {
        refetchInfiniteConversationMessages({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          caller: "useConversationListConversations",
        }).catch(captureError)
      }

      refetchConversationLastMessageIds()
    },
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [
      conversationIds,
      currentSender.inboxId,
      refetchConversations,
      refetchConversationLastMessageIds,
    ],
  )

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
    data: sortedValidConversationIds,
    refetch: handleRefetch,
    isLoading,
  }
}
