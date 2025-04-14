import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { normalizeTimestampToMs } from "@/utils/date"

export function conversationIsUnreadForInboxId(args: {
  lastMessageSentAt: number | null
  lastMessageSenderInboxId: IXmtpInboxId | null
  consumerInboxId: IXmtpInboxId
  markedAsUnread: boolean | null
  readUntil: number | null
}) {
  const {
    lastMessageSentAt,
    lastMessageSenderInboxId,
    consumerInboxId,
    markedAsUnread,
    readUntil,
  } = args

  if (markedAsUnread) {
    return true
  }

  // If the last message is from the current user, it's not unread
  if (lastMessageSenderInboxId === consumerInboxId) {
    return false
  }

  if (!lastMessageSentAt) {
    return false
  }

  if (!readUntil) {
    return true
  }

  return readUntil < normalizeTimestampToMs(lastMessageSentAt)
}
