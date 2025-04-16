import { useQueries, useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationSpamQueryOptions } from "@/features/conversation/conversation-requests-list/conversation-spam.query"
import { getUnknownConsentConversationsQueryOptions } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
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
      }),
    ),
  })

  const isLoading =
    isLoadingUnknownConsentConversationIds ||
    spamQueries.some((q) => q.isLoading) ||
    metadataQueries.some((q) => q.isLoading)

  const likelySpamConversationIds: IXmtpConversationId[] = []
  const likelyNotSpamConversationIds: IXmtpConversationId[] = []

  unknownConsentConversationIds.map((conversationId, i) => {
    const spamQuery = spamQueries[i]
    const metadataQuery = metadataQueries[i]

    if (metadataQuery.isLoading || spamQuery.isLoading) {
      return
    }

    if (metadataQuery.data?.deleted) {
      return
    }

    if (spamQuery.data) {
      likelySpamConversationIds.push(conversationId)
    } else {
      likelyNotSpamConversationIds.push(conversationId)
    }
  })

  return {
    likelyNotSpamConversationIds,
    likelySpamConversationIds,
    isLoading,
    refetch: refetchUnknownConsentConversationIds,
  }
}
