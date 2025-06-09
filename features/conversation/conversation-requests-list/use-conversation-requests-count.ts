import { useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getUnknownConsentConversationsQueryOptions } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"

export function useConversationRequestsCount() {
  const currentSender = useSafeCurrentSender()

  const {
    data: count = 0,
    isLoading,
    isFetching,
  } = useQuery({
    ...getUnknownConsentConversationsQueryOptions({
      inboxId: currentSender.inboxId,
      caller: "useConversationRequestsCount",
    }),
    select: (data) => data.length,
  })

  return {
    data: count,
    isLoading,
    isFetching,
  }
}
