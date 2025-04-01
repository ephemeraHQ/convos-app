import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function isTmpMessageId(xmtpMessageId: IXmtpMessageId) {
  // Our tmp messages have an xmtpId like ~6pcy8pj1mi6
  return xmtpMessageId.length < 12
}
