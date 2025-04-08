import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useConversationMessageStatus(props: {
  xmtpMessageId: IXmtpMessageId
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpMessageId, clientInboxId } = props

  const select = useCallback((data: IConversationMessage | null) => {
    return data?.status
  }, [])

  return useQuery({
    ...getConversationMessageQueryOptions({
      xmtpMessageId,
      clientInboxId,
      caller: "ConversationMessageStatus",
    }),
    select,
  })
}
