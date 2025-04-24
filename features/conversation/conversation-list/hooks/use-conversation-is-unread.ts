import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { conversationIsUnreadForInboxId } from "@/features/conversation/utils/conversation-is-unread-by-current-account"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type UseConversationIsUnreadArgs = {
  xmtpConversationId: IXmtpConversationId
}

export const useConversationIsUnread = ({ xmtpConversationId }: UseConversationIsUnreadArgs) => {
  const currentSender = useSafeCurrentSender()

  const { data: conversationMetadata } = useQuery(
    getConversationMetadataQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "useConversationIsUnread",
    }),
  )

  const { data: lastMessage } = useConversationLastMessage({
    xmtpConversationId,
  })

  const isUnread = useMemo(() => {
    // For now, if we don't have conversation metadata, we consider the conversation read because we don't want to be dependent on the BE
    if (!conversationMetadata) {
      return false
    }

    if (!lastMessage) {
      return false
    }

    return conversationIsUnreadForInboxId({
      lastMessageSentAt: lastMessage?.sentNs ?? null,
      lastMessageSenderInboxId: lastMessage?.senderInboxId ?? null,
      consumerInboxId: currentSender.inboxId,
      markedAsUnread: conversationMetadata?.unread ?? false,
      readUntil: conversationMetadata?.readUntil
        ? new Date(conversationMetadata.readUntil).getTime()
        : null,
    })
  }, [lastMessage, conversationMetadata, currentSender])

  return {
    isUnread,
  }
}
