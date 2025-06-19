import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  invalidateConversationMessageReactionsQuery,
  processReactionConversationMessages,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import {
  getConversationQueryData,
  maybeUpdateConversationQueryLastMessage,
} from "@/features/conversation/queries/conversation.query"
import {
  getXmtpConversationTopicFromXmtpId,
  sendXmtpConversationMessageOptimistic,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { getTodayMs, getTodayNs } from "@/utils/date"
import { GenericError } from "@/utils/error"
import { Haptics } from "@/utils/haptics"
import { IConversationMessageReactionContent } from "./conversation-message/conversation-message.types"

export function useReactOnMessage(props: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = props

  const { mutateAsync: reactOnMessageMutationAsync } = useMutation({
    mutationFn: async (variables: { reaction: IConversationMessageReactionContent }) => {
      const { reaction } = variables

      const currentSender = getSafeCurrentSender()

      const conversation = getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      if (!conversation) {
        throw new Error("Conversation not found when reacting on message")
      }

      return sendXmtpConversationMessageOptimistic({
        conversationId: conversation.xmtpId,
        clientInboxId: currentSender.inboxId,
        content: {
          reaction,
        },
      })
    },
    onMutate: async (variables) => {
      const currentSender = getSafeCurrentSender()
      const conversation = getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

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
    onSuccess: (xmtpMessageId) => {
      const currentSender = getSafeCurrentSender()
      maybeUpdateConversationQueryLastMessage({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        messageIds: [xmtpMessageId],
      }).catch(captureError)
    },
    onError: (error, variables) => {
      const currentSender = getSafeCurrentSender()
      invalidateConversationMessageReactionsQuery({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId: variables.reaction.reference,
      }).catch(captureErrorWithToast)
    },
  })

  const reactOnMessage = useCallback(
    async (args: { messageId: IXmtpMessageId; emoji: string }) => {
      try {
        const { messageId } = args

        Haptics.softImpactAsync()

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
