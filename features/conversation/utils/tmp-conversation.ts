import { IConversationTopic } from "@/features/conversation/conversation.types"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { getRandomId } from "@/utils/general"

export const TMP_CONVERSATION_PREFIX = "tmp-"

export function isTmpConversation(xmtpConversationId: IXmtpConversationId) {
  return xmtpConversationId?.startsWith(TMP_CONVERSATION_PREFIX)
}

export function generateTmpConversationId() {
  return `${TMP_CONVERSATION_PREFIX}${getRandomId()}` as IXmtpConversationId
}

export function generateTmpConversationTopic() {
  return `${TMP_CONVERSATION_PREFIX}${getRandomId()}` as IConversationTopic
}
