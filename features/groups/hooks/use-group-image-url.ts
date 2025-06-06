import { useQuery } from "@tanstack/react-query"
import { getGroupQueryOptions } from "@/features/groups/queries/group.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export function useGroupImageUrl(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useQuery({
    ...getGroupQueryOptions({
      clientInboxId: args.clientInboxId,
      xmtpConversationId: args.xmtpConversationId,
      caller: args.caller,
    }),
    select: (data) => data?.imageUrl ?? null,
  })
}
