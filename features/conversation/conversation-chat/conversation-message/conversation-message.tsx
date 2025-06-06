import emojiRegex from "emoji-regex"
import { memo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationMessageMultiRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-multi-remote-attachments"
import { ConversationMessageRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-remote-attachment"
import { ConversationMessageStaticAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-static-attachment"
import { ConversationMessageGroupUpdate } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-group-update"
import { MessageReply } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reply"
import { ConversationMessageText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-text"
import { ConversationMessageTextEmojis } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-text-emojis"
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
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"

export const ConversationMessage = memo(function ConversationMessage(props: {}) {
  const currentSender = useSafeCurrentSender()
  const xmtpMessageId = useConversationMessageContextSelector((state) => state.currentMessageId)
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { data: message } = useConversationMessageQuery({
    xmtpMessageId,
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessage",
  })

  if (!message) {
    return null
  }

  if (isTextMessage(message)) {
    if (shouldRenderBigEmoji(message.content.text)) {
      return <ConversationMessageTextEmojis message={message} />
    } else {
      return <ConversationMessageText message={message} />
    }
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
    return <ConversationMessageMultiRemoteAttachment message={message} />
  }

  const _ensureNever: never = message

  return null
})

// Compile emoji regex once
const compiledEmojiRegex = emojiRegex()

const shouldRenderBigEmoji = (text: string) => {
  const trimmedContent = text.trim()
  const emojis = trimmedContent.match(compiledEmojiRegex) || []

  const hasEmojis = emojis.length > 0
  const hasFewerThanFourEmojis = emojis.length < 4
  const containsOnlyEmojis = emojis.join("") === trimmedContent

  return hasEmojis && hasFewerThanFourEmojis && containsOnlyEmojis
}
