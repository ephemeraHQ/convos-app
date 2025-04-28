import { getHoursSinceTimestamp } from "@/utils/date"

export function messageIsRecent(message: IConvosMessage) {
  const hoursSinceLastMessage = getHoursSinceTimestamp(message.sentMs)
  return hoursSinceLastMessage <= 48 // 2 days
}
