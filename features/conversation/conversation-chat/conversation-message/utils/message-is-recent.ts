import { getHoursSinceTimestamp } from "@/utils/date"
import { IConversationMessage } from "../conversation-message.types"

export function messageIsRecent(message: IConversationMessage) {
  const hoursSinceLastMessage = getHoursSinceTimestamp(message.sentMs)
  return hoursSinceLastMessage <= 48 // 2 days
}
