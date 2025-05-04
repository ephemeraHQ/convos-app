import { useQueries } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
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
import { GenericError } from "@/utils/error"
import { customPromiseAllSettled } from "@/utils/promise-all-settlted"

export const useConversationListConversations = () => {
  const currentSender = useSafeCurrentSender()
  const isRefetchingRef = useRef(false)

  const {
    data: conversationIds = [],
    refetch: refetchConversations,
    isLoading: isLoadingConversations,
  } = useAllowedConsentConversationsQuery({
    clientInboxId: currentSender.inboxId,
    caller: "useConversationListConversations",
  })

  const { lastMessageIdByConversationId } = useConversationLastMessageIds({
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

  const handleRefetch = useCallback(async () => {
    if (isRefetchingRef.current) {
      return
    }

    isRefetchingRef.current = true

    const refetchPromises = [
      refetchConversations(),
      ...conversationIds.map((conversationId) =>
        refetchInfiniteConversationMessages({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          caller: "useConversationListConversations",
        }),
      ),
    ]

    // eslint-disable-next-line custom-plugin/require-promise-error-handling
    const results = await customPromiseAllSettled(refetchPromises)

    // Handle any errors
    results.forEach((result) => {
      if (result.status === "rejected") {
        captureError(
          new GenericError({
            error: result.reason,
            additionalMessage: "Failed to refetch conversation",
          }),
        )
      }
    })

    isRefetchingRef.current = false
  }, [currentSender.inboxId, refetchConversations, conversationIds])

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
