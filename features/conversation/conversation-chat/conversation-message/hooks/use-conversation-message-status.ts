import { queryOptions as reactQueryOptions, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useConversationMessageStatus(props: {
  xmtpMessageId: IXmtpMessageId
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpMessageId, clientInboxId, xmtpConversationId } = props

  const queryOptions = useMemo(() => {
    return reactQueryOptions({
      ...getConversationMessageQueryOptions({
        xmtpMessageId,
        clientInboxId,
        xmtpConversationId,
        caller: "ConversationMessageStatus",
      }),
      select: (data: IConversationMessage | null) => data?.status,
    })
  }, [xmtpMessageId, clientInboxId, xmtpConversationId])

  return useQuery(queryOptions)
}
