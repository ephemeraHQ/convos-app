import { useQueries, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationSpamQueryOptions } from "@/features/conversation/conversation-requests-list/conversation-spam.query"
import { getUnknownConsentConversationsQueryOptions } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export function useConversationRequestsListItem() {
  const currentSender = useSafeCurrentSender()

  const {
    data: unknownConsentConversationIds = [],
    isLoading: isLoadingUnknownConsentConversationIds,
    isFetching: isFetchingUnknownConsentConversationIds,
    refetch: refetchUnknownConsentConversationIds,
  } = useQuery({
    ...getUnknownConsentConversationsQueryOptions({
      inboxId: currentSender.inboxId,
      caller: "useConversationRequestsListItem",
    }),
  })

  const spamQueries = useQueries({
    queries: (unknownConsentConversationIds ?? []).map((conversationId) =>
      getConversationSpamQueryOptions({
        xmtpConversationId: conversationId,
        clientInboxId: currentSender.inboxId,
      }),
    ),
  })

  // const metadataQueries = useQueries({
  //   queries: (unknownConsentConversationIds ?? []).map((conversationId) =>
  //     getConversationMetadataQueryOptions({
  //       clientInboxId: currentSender.inboxId,
  //       xmtpConversationId: conversationId,
  //       caller: "useConversationRequestsListItem",
  //     }),
  //   ),
  // })

  const conversationQueries = useQueries({
    queries: (unknownConsentConversationIds ?? []).map((conversationId) =>
      getConversationQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useConversationRequestsListItem",
      }),
    ),
  })

  const isLoading =
    isLoadingUnknownConsentConversationIds ||
    spamQueries.some((q) => q.isLoading) ||
    // metadataQueries.some((q) => q.isLoading) ||
    conversationQueries.some((q) => q.isLoading)

  const isFetching =
    isFetchingUnknownConsentConversationIds ||
    spamQueries.some((q) => q.isFetching) ||
    // metadataQueries.some((q) => q.isFetching) ||
    conversationQueries.some((q) => q.isFetching)

  const likelySpamItems: Array<{
    conversationId: IXmtpConversationId
    lastMessageTimestamp: number
  }> = []
  const likelyNotSpamItems: Array<{
    conversationId: IXmtpConversationId
    lastMessageTimestamp: number
  }> = []

  unknownConsentConversationIds.map((conversationId, i) => {
    const spamQuery = spamQueries[i]
    // const metadataQuery = metadataQueries[i]
    const conversationQuery = conversationQueries[i]

    if (
      // metadataQuery.isLoading
      spamQuery.isLoading ||
      conversationQuery.isLoading
    ) {
      return
    }

    // if (metadataQuery.data?.deleted) {
    //   return
    // }

    if (!conversationQuery.data) {
      // Skip if conversation data is not available
      return
    }

    const conversation = conversationQuery.data
    const lastMessageTimestamp = conversation.lastMessage?.sentMs ?? conversation.createdAt

    if (spamQuery.data) {
      likelySpamItems.push({ conversationId, lastMessageTimestamp })
    } else {
      likelyNotSpamItems.push({ conversationId, lastMessageTimestamp })
    }
  })

  // Sort in descending order (newest first)
  likelySpamItems.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
  likelyNotSpamItems.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)

  const sortedLikelySpamConversationIds = likelySpamItems.map((item) => item.conversationId)
  const sortedLikelyNotSpamConversationIds = likelyNotSpamItems.map((item) => item.conversationId)

  const handleRefetch = useCallback(async () => {
    try {
      await Promise.all([
        refetchUnknownConsentConversationIds(),
        // ...spamQueries.map((q) => q.refetch()),
        // ...metadataQueries.map((q) => q.refetch()),
      ])
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: "Error refreshing conversation requests list",
        }),
      )
    }
  }, [
    refetchUnknownConsentConversationIds,
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    // spamQueries,
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    // metadataQueries,
  ])

  return {
    likelyNotSpamConversationIds: sortedLikelyNotSpamConversationIds,
    likelySpamConversationIds: sortedLikelySpamConversationIds,
    isLoading,
    refetch: handleRefetch,
    isFetching,
  }
}
