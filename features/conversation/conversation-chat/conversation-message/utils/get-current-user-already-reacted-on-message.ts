import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageReactionsQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getCurrentUserAlreadyReactedOnMessage(args: {
  messageId: IXmtpMessageId
  emoji: string | undefined
}) {
  const { messageId, emoji } = args

  const currentSender = getSafeCurrentSender()

  const reactions = getConversationMessageReactionsQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: messageId,
  })

  const senderReactions = reactions?.bySender[currentSender.inboxId]

  return senderReactions?.some((reaction) => !emoji || reaction.content === emoji)
}
