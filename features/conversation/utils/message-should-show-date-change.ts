import differenceInMinutes from "date-fns/differenceInMinutes"
import { Nullable } from "@/types/general"
import { normalizeTimestampToMs } from "@/utils/date"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type MessageShouldShowDateChangePayload = {
  messageOne: Nullable<IConversationMessage>
  messageTwo: Nullable<IConversationMessage>
}

export const messageShouldShowDateChange = ({
  messageOne,
  messageTwo,
}: MessageShouldShowDateChangePayload) => {
  if (!messageOne) {
    return false
  }

  if (!messageTwo) {
    return true
  }

  const minutes = differenceInMinutes(
    normalizeTimestampToMs(messageOne.sentNs),
    normalizeTimestampToMs(messageTwo.sentNs),
  )

  return Math.abs(minutes) >= 5
}
