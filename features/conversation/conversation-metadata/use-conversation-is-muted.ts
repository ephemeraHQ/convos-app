import { useQuery } from "@tanstack/react-query"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

export function useConversationIsMuted(args: {
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  const { xmtpConversationId, caller } = args
  const currentSender = useSafeCurrentSender()

  const { data: isMuted } = useQuery({
    ...getConversationMetadataQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: `${caller}:useConversationIsMuted`,
    }),
    select: (data) => data?.muted,
  })

  return {
    data: isMuted,
  }
}
