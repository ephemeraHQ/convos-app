import { useCallback } from "react"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import { getConversationMetadataQueryData } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useMarkConversationAsReadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useMarkConversationAsUnreadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-unread"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { conversationIsUnreadForInboxId } from "@/features/conversation/utils/conversation-is-unread-by-current-account"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"

type UseToggleReadStatusProps = {
  xmtpConversationId: IXmtpConversationId
}

export const useToggleReadStatus = ({ xmtpConversationId }: UseToggleReadStatusProps) => {
  const { mutateAsync: markAsReadAsync } = useMarkConversationAsReadMutation({
    xmtpConversationId,
    caller: "useToggleReadStatus",
  })
  const { mutateAsync: markAsUnreadAsync } = useMarkConversationAsUnreadMutation({
    xmtpConversationId,
    caller: "useToggleReadStatus",
  })

  const currentSender = useSafeCurrentSender()

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "useToggleReadStatus",
  })

  const { data: lastMessage } = useConversationLastMessage({
    xmtpConversationId,
    caller: "useToggleReadStatus",
  })

  const toggleReadStatusAsync = useCallback(async () => {
    const currentSender = getSafeCurrentSender()

    if (!conversation) {
      throw new Error("Conversation not found")
    }

    const conversationData = getConversationMetadataQueryData({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
    })

    const conversationIsUnread = conversationIsUnreadForInboxId({
      lastMessageSentAt: lastMessage?.sentNs ?? null,
      lastMessageSenderInboxId: lastMessage?.senderInboxId ?? null,
      consumerInboxId: currentSender.inboxId,
      readUntil: conversationData?.readUntil
        ? new Date(conversationData.readUntil).getTime()
        : null,
      markedAsUnread: conversationData?.unread ?? false,
    })

    if (conversationIsUnread) {
      await markAsReadAsync()
    } else {
      await markAsUnreadAsync()
    }
  }, [markAsReadAsync, markAsUnreadAsync, xmtpConversationId, conversation, lastMessage])

  return { toggleReadStatusAsync }
}
