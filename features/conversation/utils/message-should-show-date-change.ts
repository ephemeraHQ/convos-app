import differenceInMinutes from "date-fns/differenceInMinutes"
import { normalizeTimestampToMs } from "@/utils/date"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type MessageShouldShowDateChangePayload = {
  messageOne: IConversationMessage | undefined
  messageTwo: IConversationMessage | undefined
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
