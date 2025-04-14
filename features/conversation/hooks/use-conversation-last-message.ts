import { useInfiniteQuery } from "@tanstack/react-query"
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

  const { data: lastMessageId, isLoading: isLoadingLastMessageId } = useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages",
    }),
    select: (data) => {
      return data.pages[0]?.messageIds[0]
    },
  })

  const { data: lastMessage, isLoading: isLoadingLastMessage } = useConversationMessageQuery({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: lastMessageId,
    caller: "Conversation Last Message",
  })

  return {
    data: lastMessage,
    isLoading: isLoadingLastMessageId || isLoadingLastMessage,
  }
}
