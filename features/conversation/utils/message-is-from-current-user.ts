import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
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
  const currentSender = getSafeCurrentSender()
  const messageSenderInboxId = message?.senderInboxId

  if (!currentSender.inboxId) {
    logger.warn("[messageIsFromCurrentAccountInboxId] No current account inbox id")
    return false
  }

  if (!messageSenderInboxId) {
    logger.warn("[messageIsFromCurrentAccountInboxId] No message sender inbox id")
    return false
  }

  return isSameInboxId(messageSenderInboxId, currentSender.inboxId)
}

export function useMessageIsFromCurrentSenderInboxId(args: { xmtpMessageId: IXmtpMessageId }) {
  const { xmtpMessageId } = args

  const currentSender = useSafeCurrentSender()

  const select = useCallback((message: IConversationMessage | null) => {
    return message && messageIsFromCurrentSenderInboxId({ message })
  }, [])

  return useQuery({
    ...getConversationMessageQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpMessageId,
      caller: "useMessageIsFromCurrentSenderInboxId",
    }),
    select,
  })
}
