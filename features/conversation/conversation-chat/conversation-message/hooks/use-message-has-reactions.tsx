import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  getConversationMessageReactionsQueryOptions,
  IConversationMessageReactions,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function useMessageHasReactions(args: { xmtpMessageId: IXmtpMessageId }) {
  const { xmtpMessageId } = args

  const currentSender = getSafeCurrentSender()

  const select = useCallback((data: IConversationMessageReactions) => {
    return Object.values(data.bySender || {}).some((reactions) => reactions.length > 0)
  }, [])

  return useQuery({
    ...getConversationMessageReactionsQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpMessageId,
    }),
    select,
  })
}
