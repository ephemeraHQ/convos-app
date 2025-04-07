import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  getConversationMessagesInfiniteQueryOptions,
  IConversationMessagesInfiniteQueryData,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type HasNextMessageInSeriesPayload = {
  currentMessage: IConversationMessage
  nextMessage: IConversationMessage | undefined
}

export const getHasNextMessageInSeries = ({
  currentMessage,
  nextMessage,
}: HasNextMessageInSeriesPayload) => {
  if (!nextMessage) {
    return false
  }

  if (isGroupUpdatedMessage(nextMessage)) {
    return false
  }

  return nextMessage.senderInboxId === currentMessage.senderInboxId
}

export function useHasNextMessageInSeries(args: {
  currentMessageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { currentMessageId, xmtpConversationId } = args
  const currentSender = useSafeCurrentSender()
  const clientInboxId = currentSender.inboxId

  const queryOptions = useMemo(
    () =>
      getConversationMessagesInfiniteQueryOptions({
        clientInboxId,
        xmtpConversationId,
        caller: "useHasNextMessageInSeries",
      }),
    [clientInboxId, xmtpConversationId],
  )

  const select = useCallback(
    (data: IConversationMessagesInfiniteQueryData) => {
      const allMessageIds = data?.pages.flatMap((page) => page.messageIds) || []
      const currentIndex = allMessageIds.findIndex((id) => id === currentMessageId)

      if (currentIndex === -1 || !allMessageIds[currentIndex - 1]) {
        return false
      }

      const nextMessageId = allMessageIds[currentIndex - 1]

      const currentMessage = getConversationMessageQueryData({
        clientInboxId,
        xmtpMessageId: currentMessageId,
      })

      const nextMessage = getConversationMessageQueryData({
        clientInboxId,
        xmtpMessageId: nextMessageId,
      })

      if (!currentMessage || !nextMessage) {
        return false
      }

      return getHasNextMessageInSeries({ currentMessage, nextMessage })
    },
    [currentMessageId, clientInboxId],
  )

  return useInfiniteQuery({
    ...queryOptions,
    select,
  })
}
