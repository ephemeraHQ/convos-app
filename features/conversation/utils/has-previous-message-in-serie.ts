import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type HasPreviousMessageInSeriesPayload = {
  currentMessage?: IConversationMessage
  previousMessage?: IConversationMessage
}

export const hasPreviousMessageInSeries = ({
  currentMessage,
  previousMessage,
}: HasPreviousMessageInSeriesPayload) => {
  if (!previousMessage || !currentMessage) {
    return false
  }

  if (isGroupUpdatedMessage(previousMessage)) {
    return false
  }

  return previousMessage.senderInboxId === currentMessage.senderInboxId
}
