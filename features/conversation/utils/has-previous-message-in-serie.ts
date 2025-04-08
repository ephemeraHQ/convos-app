import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { messageShouldShowDateChange } from "@/features/conversation/utils/message-should-show-date-change"
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

  // if (
  //   messageShouldShowDateChange({
  //     messageOne: currentMessage,
  //     messageTwo: previousMessage,
  //   })
  // ) {
  //   return false
  // }

  return previousMessage.senderInboxId === currentMessage.senderInboxId
}
