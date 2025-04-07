import { useQuery } from "@tanstack/react-query"
import { getDmQueryOptions } from "@/features/dm/dm.query"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"

export function useDmPeerInboxId(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  caller: string
}) {
  return useQuery({
    ...getDmQueryOptions({
      clientInboxId: args.clientInboxId,
      xmtpConversationId: args.xmtpConversationId,
      caller: args.caller,
    }),
    select: (data) => data?.peerInboxId,
  })
}
