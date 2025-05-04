import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { getConversationMessagesInfiniteQueryOptions } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type IArgs = {
  xmtpConversationId: IXmtpConversationId
}

export function useConversationLastMessage(args: IArgs) {
  const { xmtpConversationId } = args
  const currentSender = useSafeCurrentSender()

  const queryOptions = useMemo(() => {
    return infiniteQueryOptions({
      ...getConversationMessagesInfiniteQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: "useConversationLastMessage",
      }),
      select: (data) => {
        return data.pages[0].messageIds[0]
      },
    })
  }, [currentSender.inboxId, xmtpConversationId])

  const { data: lastMessageId, isLoading: isLoadingLastMessageId } = useInfiniteQuery(queryOptions)

  const { data: lastMessage, isLoading: isLoadingLastMessage } = useConversationMessageQuery({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: lastMessageId,
    caller: "useConversationLastMessage",
  })

  return {
    data: lastMessage,
    isLoading: isLoadingLastMessageId || isLoadingLastMessage,
  }
}
