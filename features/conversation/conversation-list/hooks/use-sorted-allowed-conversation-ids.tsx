import { useQueries } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  getAllowedConsentConversationsQueryOptions,
  useAllowedConsentConversationsQuery,
} from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"
import { refetchQueryIfNotAlreadyFetching } from "@/utils/react-query/react-query.helpers"

export function useSortedAllowedConversationIds() {
  const currentSender = useSafeCurrentSender()
  const isRefetchingRef = useRef(false)

  const { data: allowedConversationIds = [], isLoading: isLoadingAllowedConversations } =
    useAllowedConsentConversationsQuery({
      clientInboxId: currentSender.inboxId,
      caller: "useSortedAllowedConversationIds",
    })

  const conversationQueries = useQueries({
    queries: allowedConversationIds.map((conversationId) =>
      getConversationQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useSortedAllowedConversationIds",
      }),
    ),
  })

  const conversationMetadataQueries = useQueries({
    queries: allowedConversationIds.map((conversationId) =>
      getConversationMetadataQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useSortedAllowedConversationIds",
      }),
    ),
  })

  let validConversationIds = allowedConversationIds.reduce(
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

      const lastMessage = conversation.lastMessage

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
      // Refetch all allowed conversations ids
      refetchQueryIfNotAlreadyFetching({
        queryKey: getAllowedConsentConversationsQueryOptions({
          clientInboxId: currentSender.inboxId,
          caller: "useSortedAllowedConversationIds",
        }).queryKey,
      }),
      // Refetch all conversation metadata
      // DON'T because it's not needed and heavy for nothing
      // ...allowedConversationIds.map((conversationId) =>
      //   refetchQueryIfNotAlreadyFetching(
      //     getConversationMetadataQueryOptions({
      //       xmtpConversationId: conversationId,
      //       clientInboxId: currentSender.inboxId,
      //     }),
      //   ),
      // ),
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
  }, [currentSender.inboxId])

  const hasAnyConversationLoading = conversationQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const hasAnyMetadataLoading = conversationMetadataQueries.some(
    (query) => query.isLoading && !query.data,
  )
  const isLoading =
    isLoadingAllowedConversations || hasAnyMetadataLoading || hasAnyConversationLoading

  return {
    data: sortedValidConversationIds,
    refetch: handleRefetch,
    isLoading,
  }
}
