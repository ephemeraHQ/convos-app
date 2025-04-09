import { useQueries, useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { getConversationSpamQueryOptions } from "@/features/conversation/conversation-requests-list/conversation-spam.query"
import { getUnknownConsentConversationsQueryOptions } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"

export function useConversationRequestsListItem() {
  const currentSender = useSafeCurrentSender()

  const {
    data: unknownConsentConversationIds,
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
    metadataQueries.some((q) => q.isLoading && !q.data)

  // Filter and prepare results, checking both spam status and metadata
  const processedResults =
    unknownConsentConversationIds?.map((conversationId, i) => {
      const isSpam = spamQueries[i].data ?? true
      const metadata = metadataQueries[i].data
      const isDeleted = metadata?.deleted ?? false

      return {
        conversationId,
        isSpam,
        isDeleted,
      }
    }) ?? []

  // Filter out deleted conversations
  const nonDeletedResults = processedResults.filter((r) => !r.isDeleted)

  return {
    likelyNotSpamConversationIds:
      nonDeletedResults.filter((r) => !r.isSpam).map((r) => r.conversationId) ?? [],
    likelySpamConversationIds:
      nonDeletedResults.filter((r) => r.isSpam).map((r) => r.conversationId) ?? [],
    isLoading,
    refetch: refetchUnknownConsentConversationIds,
  }
}
