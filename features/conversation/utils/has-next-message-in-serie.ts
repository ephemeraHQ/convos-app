import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { messageShouldShowDateChange } from "@/features/conversation/utils/message-should-show-date-change"
import { Nullable } from "@/types/general"
import { IConversationMessage } from "../conversation-chat/conversation-message/conversation-message.types"

type HasNextMessageInSeriesPayload = {
  currentMessage: Nullable<IConversationMessage>
  nextMessage: Nullable<IConversationMessage>
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

  if (
    messageShouldShowDateChange({
      messageOne: nextMessage,
      messageTwo: currentMessage,
    })
  ) {
    return false
  }

  if (!currentMessage) {
    return false
  }

  return nextMessage.senderInboxId === currentMessage.senderInboxId
}

// export function useHasNextMessageInSeries(args: {
//   currentMessageId: IXmtpMessageId
//   xmtpConversationId: IXmtpConversationId
// }) {
//   const { currentMessageId, xmtpConversationId } = args
//   const currentSender = useSafeCurrentSender()
//   const clientInboxId = currentSender.inboxId

//   const queryOptions = useMemo(
//     () =>
//       getConversationMessagesInfiniteQueryOptions({
//         clientInboxId,
//         xmtpConversationId,
//         caller: "useHasNextMessageInSeries",
//       }),
//     [clientInboxId, xmtpConversationId],
//   )

//   const select = useCallback(
//     (data: IConversationMessagesInfiniteQueryData) => {
//       const allMessageIds = data?.pages.flatMap((page) => page.messageIds) || []
//       const currentIndex = allMessageIds.findIndex((id) => id === currentMessageId)

//       if (currentIndex === -1 || !allMessageIds[currentIndex - 1]) {
//         return false
//       }

//       const nextMessageId = allMessageIds[currentIndex - 1]

//       const currentMessage = getConversationMessageQueryData({
//         clientInboxId,
//         xmtpMessageId: currentMessageId,
//       })

//       const nextMessage = getConversationMessageQueryData({
//         clientInboxId,
//         xmtpMessageId: nextMessageId,
//       })

//       if (!currentMessage || !nextMessage) {
//         return false
//       }

//       return getHasNextMessageInSeries({ currentMessage, nextMessage })
//     },
//     [currentMessageId, clientInboxId],
//   )

//   return useInfiniteQuery({
//     ...queryOptions,
//     select,
//   })
// }
