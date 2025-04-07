import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { getRandomId } from "@/utils/general"

export const TEMP_CONVERSATION_PREFIX = "tmp-"

export function isTempConversation(xmtpConversationId: IXmtpConversationId) {
  return xmtpConversationId?.startsWith(TEMP_CONVERSATION_PREFIX)
}

export function generateTempConversationId() {
  return `${TEMP_CONVERSATION_PREFIX}${getRandomId()}` as IXmtpConversationId
}
