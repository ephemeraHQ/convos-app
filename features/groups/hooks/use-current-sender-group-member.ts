import { IXmtpConversationId } from "@features/xmtp/xmtp.types"
import { useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getGroupQueryOptions } from "@/features/groups/queries/group.query"

export function useCurrentSenderGroupMember(args: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = args

  const currentSender = useSafeCurrentSender()

  const { data: currentSenderGroupMember, isLoading: isLoadingCurrentSenderGroupMember } = useQuery(
    {
      ...getGroupQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: "useCurrentSenderGroupMember",
      }),
      select: (group) => group?.members?.byId[currentSender.inboxId],
    },
  )

  return {
    currentSenderGroupMember,
    isLoadingCurrentSenderGroupMember,
  }
}
