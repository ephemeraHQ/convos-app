import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { getAllConversationMessageIds } from "@/features/conversation/conversation-chat/conversation-messages-simple.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"

export function getConversationPreviousMessage(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { messageId, xmtpConversationId } = args

  const currentSender = getSafeCurrentSender()

  const messageIds =
    getAllConversationMessageIds({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
    }) || []

  if (!messageIds.includes(messageId)) {
    return undefined
  }

  const currentIndex = messageIds.indexOf(messageId)
  const previousMessageId = messageIds[currentIndex + 1]

  if (!previousMessageId) {
    return null
  }

  return getConversationMessageQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpMessageId: previousMessageId,
    xmtpConversationId,
  })
}

// export function useConversationPreviousMessageId(args: {
//   messageId: IXmtpMessageId
//   xmtpConversationId: IXmtpConversationId
//   caller: string
// }) {
//   const { messageId, xmtpConversationId, caller } = args

//   const currentSender = useSafeCurrentSender()

//   return useInfiniteQuery({
//     ...getConversationMessagesInfiniteQueryOptions({
//       clientInboxId: currentSender.inboxId,
//       xmtpConversationId,
//       caller,
//     }),
//     select: (data) => {
//       const allMessageIds = data?.pages.flatMap((page) => page.messageIds)

//       if (!allMessageIds) {
//         return undefined
//       }

//       const currentIndex = allMessageIds.findIndex((id) => id === messageId)

//       if (currentIndex === -1) {
//         return undefined
//       }

//       return allMessageIds[currentIndex + 1]
//     },
//   })
// }
