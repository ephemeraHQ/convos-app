import { useQueries } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { refetchInfiniteConversationMessages } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useAllowedConsentConversationsQuery } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useConversationLastMessageIds } from "@/features/conversation/hooks/use-conversation-last-messages"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"

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

  const lastMessageQueries = useQueries({
    queries: conversationIds.map((conversationId) =>
      getConversationMessageQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        xmtpMessageId: lastMessageIdByConversationId[conversationId],
      }),
    ),
  })

  const conversationQueries = useQueries({
    queries: conversationIds.map((conversationId) =>
      getConversationQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useConversationListConversations",
      }),
    ),
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
      const conversation = conversationQueries[index].data
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

      const lastMessageQuery = lastMessageQueries[index]
      const lastMessage = lastMessageQuery.data

      acc.push({
        conversationId,
        timestamp: lastMessage?.sentMs ?? conversation.createdAt,
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

  const hasAnyConversationLoading = conversationQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const hasAnyLastMessageLoading = lastMessageQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const hasAnyMetadataLoading = conversationMetadataQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const isLoading =
    isLoadingConversations ||
    hasAnyMetadataLoading ||
    hasAnyLastMessageLoading ||
    hasAnyConversationLoading

  return {
    data: sortedValidConversationIds,
    refetch: handleRefetch,
    isLoading,
  }
}
