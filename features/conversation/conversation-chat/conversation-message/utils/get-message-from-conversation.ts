import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getMessageFromConversationSafe({
  messageId,
  clientInboxId,
}: {
  messageId: IXmtpMessageId
  clientInboxId: IXmtpInboxId
}) {
  const message = getConversationMessageQueryData({
    clientInboxId,
    xmtpMessageId: messageId,
  })

  if (!message) {
    throw new Error(`Couldn't get conversation message`)
  }

  return message
}
