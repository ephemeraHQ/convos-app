import { useQuery } from "@tanstack/react-query"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isSameInboxId } from "@/features/xmtp/xmtp-inbox-id/xmtp-inbox-id.utils"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { logger } from "@/utils/logger/logger"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type MessageFromCurrentUserPayload = {
  message: IConversationMessage
}

export function messageIsFromCurrentSenderInboxId({ message }: MessageFromCurrentUserPayload) {
  const { inboxId: currentInboxId } = getSafeCurrentSender()
  const messageSenderInboxId = message?.senderInboxId

  if (!currentInboxId) {
    logger.warn("[messageIsFromCurrentAccountInboxId] No current account inbox id")
    return false
  }

  if (!messageSenderInboxId) {
    logger.warn("[messageIsFromCurrentAccountInboxId] No message sender inbox id")
    return false
  }

  return isSameInboxId(messageSenderInboxId, currentInboxId)
}

export function useMessageIsFromCurrentSenderInboxId(args: { xmtpMessageId: IXmtpMessageId }) {
  const { xmtpMessageId } = args

  const currentSender = useSafeCurrentSender()

  return useQuery({
    ...getConversationMessageQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpMessageId,
    }),
    select: (message) => message && messageIsFromCurrentSenderInboxId({ message }),
  })
}
