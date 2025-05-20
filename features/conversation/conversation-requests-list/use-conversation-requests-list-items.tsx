import { useQueries, useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationSpamQueryOptions } from "@/features/conversation/conversation-requests-list/conversation-spam.query"
import { getUnknownConsentConversationsQueryOptions } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export function useConversationRequestsListItem() {
  const currentSender = useSafeCurrentSender()

  const {
    data: unknownConsentConversationIds = [],
    isLoading: isLoadingUnknownConsentConversationIds,
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

  const metadataQueries = useQueries({
    queries: (unknownConsentConversationIds ?? []).map((conversationId) =>
      getConversationMetadataQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "useConversationRequestsListItem",
      }),
    ),
  })

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
    metadataQueries.some((q) => q.isLoading) ||
    conversationQueries.some((q) => q.isLoading)

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
    const metadataQuery = metadataQueries[i]
    const conversationQuery = conversationQueries[i]

    if (metadataQuery.isLoading || spamQuery.isLoading || conversationQuery.isLoading) {
      return
    }

    if (metadataQuery.data?.deleted) {
      return
    }

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

  return {
    likelyNotSpamConversationIds: sortedLikelyNotSpamConversationIds,
    likelySpamConversationIds: sortedLikelySpamConversationIds,
    isLoading,
    refetch: refetchUnknownConsentConversationIds,
  }
}
