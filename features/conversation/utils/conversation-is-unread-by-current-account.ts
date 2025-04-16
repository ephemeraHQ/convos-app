import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { Nullable } from "@/types/general"
import { normalizeTimestampToMs } from "@/utils/date"

export function conversationIsUnreadForInboxId(args: {
  consumerInboxId: IXmtpInboxId
  lastMessageSentAt: Nullable<number>
  lastMessageSenderInboxId: Nullable<IXmtpInboxId>
  markedAsUnread: Nullable<boolean>
  readUntil: Nullable<number>
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
