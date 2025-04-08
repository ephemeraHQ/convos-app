import { useQuery } from "@tanstack/react-query"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export function useConversationType(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useQuery({
    ...getConversationQueryOptions({
      clientInboxId: args.clientInboxId,
      xmtpConversationId: args.xmtpConversationId,
      caller: args.caller,
    }),
    select: (data) => (isConversationDm(data) ? "dm" : "group"),
  })
}
