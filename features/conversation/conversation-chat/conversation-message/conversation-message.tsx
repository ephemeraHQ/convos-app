import { memo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { MessageMultiRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-multi-remote-attachments"
import { ConversationMessageRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-remote-attachment"
import { ConversationMessageStaticAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-static-attachment"
import { ConversationMessageGroupUpdate } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-group-update"
import { MessageReply } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reply"
import { ConversationMessageSimpleText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-simple-text"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import {
  isGroupUpdatedMessage,
  isMultiRemoteAttachmentMessage,
  isReactionMessage,
  isReadReceiptMessage,
  isRemoteAttachmentMessage,
  isReplyMessage,
  isStaticAttachmentMessage,
  isTextMessage,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"

export const ConversationMessage = memo(function ConversationMessage(props: {}) {
  const currentSender = useSafeCurrentSender()

  const xmtpMessageId = useConversationMessageContextSelector((state) => state.xmtpMessageId)

  const { data: message } = useConversationMessageQuery({
    xmtpMessageId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessage",
  })

  if (!message) {
    return null
  }

  if (isTextMessage(message)) {
    return <ConversationMessageSimpleText message={message} />
  }

  if (isGroupUpdatedMessage(message)) {
    return <ConversationMessageGroupUpdate message={message} />
  }

  if (isReplyMessage(message)) {
    return <MessageReply message={message} />
  }

  if (isRemoteAttachmentMessage(message)) {
    return <ConversationMessageRemoteAttachment message={message} />
  }

  if (isStaticAttachmentMessage(message)) {
    return <ConversationMessageStaticAttachment message={message} />
  }

  if (isReactionMessage(message)) {
    // Handle in message
    return null
  }

  if (isReadReceiptMessage(message)) {
    // Not handled here
    return null
  }

  if (isMultiRemoteAttachmentMessage(message)) {
    return <MessageMultiRemoteAttachment message={message} />
  }

  const _ensureNever: never = message

  return null
})
