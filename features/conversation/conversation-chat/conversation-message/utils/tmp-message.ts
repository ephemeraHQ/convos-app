import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { getRandomId } from "@/utils/general"

const TMP_MESSAGE_ID_PREFIX = "tmp-"

export function isTmpMessageId(xmtpMessageId: IXmtpMessageId) {
  return xmtpMessageId.startsWith(TMP_MESSAGE_ID_PREFIX)
}

export function generateTmpMessageId() {
  return `${TMP_MESSAGE_ID_PREFIX}${getRandomId()}` as IXmtpMessageId
}
