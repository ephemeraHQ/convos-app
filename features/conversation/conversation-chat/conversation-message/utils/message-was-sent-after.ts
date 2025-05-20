import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"

export function messageWasSentAfter(
  firstMessage: IConversationMessage,
  secondMessage: IConversationMessage,
) {
  return firstMessage.sentMs > secondMessage.sentMs
}
