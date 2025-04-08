import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { processReactionConversationMessages } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { getRealMessageIdForOptimisticMessageId } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { isTmpMessageId } from "@/features/conversation/conversation-chat/conversation-message/utils/is-tmp-message"
import { invalidateConversationMessagesInfiniteMessagesQuery } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { getConversationForCurrentAccount } from "@/features/conversation/utils/get-conversation-for-current-account"
import {
  getXmtpConversationTopicFromXmtpId,
  sendXmtpConversationMessage,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureErrorWithToast } from "@/utils/capture-error"
import { getTodayMs, getTodayNs } from "@/utils/date"
import { GenericError } from "@/utils/error"
import { Haptics } from "@/utils/haptics"
import { IConversationMessageReactionContent } from "./conversation-message/conversation-message.types"

export function useReactOnMessage(props: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = props

  const { mutateAsync: reactOnMessageMutationAsync } = useMutation({
    mutationFn: async (variables: { reaction: IConversationMessageReactionContent }) => {
      const { reaction } = variables

      const conversation = getConversationForCurrentAccount(xmtpConversationId)

      if (!conversation) {
        throw new Error("Conversation not found when reacting on message")
      }

      const currentSender = getSafeCurrentSender()

      await sendXmtpConversationMessage({
        conversationId: conversation.xmtpId,
        clientInboxId: currentSender.inboxId,
        content: {
          reaction,
        },
      })
    },
    onMutate: async (variables) => {
      const currentSender = getSafeCurrentSender()
      const conversation = getConversationForCurrentAccount(xmtpConversationId)

      if (conversation) {
        // Add the reaction to the message
        processReactionConversationMessages({
          clientInboxId: currentSender.inboxId,
          reactionMessages: [
            {
              xmtpId: "" as IXmtpMessageId,
              senderInboxId: currentSender.inboxId,
              xmtpTopic: getXmtpConversationTopicFromXmtpId(xmtpConversationId),
              type: "reaction",
              sentNs: getTodayNs(),
              sentMs: getTodayMs(),
              status: "sent",
              xmtpConversationId,
              content: variables.reaction,
            },
          ],
        })
      }
    },
    onError: (error) => {
      const currentSender = getSafeCurrentSender()
      invalidateConversationMessagesInfiniteMessagesQuery({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      }).catch(captureErrorWithToast)
    },
  })

  const reactOnMessage = useCallback(
    async (args: { messageId: IXmtpMessageId; emoji: string }) => {
      try {
        Haptics.softImpactAsync()

        const messageId = isTmpMessageId(args.messageId)
          ? getRealMessageIdForOptimisticMessageId(args.messageId)
          : args.messageId

        if (!messageId) {
          throw new Error("Message not found when reacting on message")
        }

        await reactOnMessageMutationAsync({
          reaction: {
            reference: messageId,
            content: args.emoji,
            schema: "unicode",
            action: "added",
          },
        })
      } catch (error) {
        captureErrorWithToast(
          new GenericError({ error, additionalMessage: "Error reacting on message" }),
        )
      }
    },
    [reactOnMessageMutationAsync],
  )

  return {
    reactOnMessage,
  }
}
