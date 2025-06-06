import { queryOptions, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type IArgs = {
  xmtpConversationId: IXmtpConversationId
  caller: string
}

export function useConversationLastMessage(args: IArgs) {
  const { xmtpConversationId, caller } = args
  const currentSender = useSafeCurrentSender()

  const options = useMemo(() => {
    return queryOptions({
      ...getConversationQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: `${caller}:useConversationLastMessage`,
      }),
      select: (data) => {
        return data.lastMessage
      },
    })
  }, [currentSender.inboxId, xmtpConversationId, caller])

  const { data: lastMessage, isLoading: isLoadingLastMessage } = useQuery(options)

  return {
    data: lastMessage,
    isLoading: isLoadingLastMessage,
  }
}
