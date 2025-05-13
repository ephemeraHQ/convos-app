import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  getConversationMessageQueryData,
  invalidateConversationMessageQuery,
  refetchConversationMessageQuery,
  setConversationMessageQueryData,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { messageContentIsReply } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import {
  addMessagesToConversationMessagesInfiniteQueryData,
  invalidateConversationMessagesInfiniteMessagesQuery,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { invalidateConversationQuery } from "@/features/conversation/queries/conversation.query"
import { convertConvosMessageContentToXmtpMessageContent } from "@/features/conversation/utils/convert-convos-message-content-to-xmtp-message-content"
import {
  publishXmtpConversationMessages,
  sendXmtpConversationMessageOptimistic,
} from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { getXmtpConversationMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError, ReactQueryError } from "@/utils/error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import {
  IConversationMessage,
  IConversationMessageContent,
} from "../conversation-chat/conversation-message/conversation-message.types"
import { IConversation } from "../conversation.types"

export type ISendMessageOptimisticallyParams = {
  xmtpConversationId: IXmtpConversationId
  contents: IConversationMessageContent[] // Array because we can send text at same time as attachments for example
}

type ISentOptimisticMessage = IConversationMessage & {
  status: "sending"
}

export type ISendMessageReturnType = Awaited<ReturnType<typeof sendMessageOptimistically>>

export async function sendMessageOptimistically(args: ISendMessageOptimisticallyParams) {
  const { contents, xmtpConversationId } = args

  const currentSender = getSafeCurrentSender()

  const sentMessages: ISentOptimisticMessage[] = []

  // Send each content as a separate message
  for (const content of contents) {
    let sentXmtpMessageId: IXmtpMessageId | null = null

    const payload = convertConvosMessageContentToXmtpMessageContent(content)

    if (messageContentIsReply(content)) {
      // Content is already a reply, send it with the inner content properly converted
      const innerPayload = convertConvosMessageContentToXmtpMessageContent(content.content)

      sentXmtpMessageId = await sendXmtpConversationMessageOptimistic({
        clientInboxId: currentSender.inboxId,
        conversationId: xmtpConversationId,
        content: {
          reply: {
            reference: content.reference,
            content: innerPayload,
          },
        },
      })
    } else {
      // Send as a regular message
      sentXmtpMessageId = await sendXmtpConversationMessageOptimistic({
        clientInboxId: currentSender.inboxId,
        conversationId: xmtpConversationId,
        content: payload,
      })
    }

    if (!sentXmtpMessageId) {
      captureError(
        new GenericError({
          error: new Error(`Couldn't send message?`),
        }),
      )
      continue // Skip if we couldn't send this message
    }

    const sentXmtpMessage = await getXmtpConversationMessage({
      messageId: sentXmtpMessageId,
      clientInboxId: currentSender.inboxId,
    })

    // Not supposed to happen but just in case
    if (!sentXmtpMessage) {
      captureError(
        new GenericError({
          error: new Error(`Couldn't get the full xmtp message after sending`),
        }),
      )
      continue
    }

    sentMessages.push(convertXmtpMessageToConvosMessage(sentXmtpMessage) as ISentOptimisticMessage)
  }

  if (sentMessages.length === 0) {
    throw new Error("Couldn't send any messages")
  }

  return sentMessages
}

type ISendMessageContext = {
  tmpXmtpMessageIds: IXmtpMessageId[]
  optimisticMessages: IConversationMessage[]
  previousConversation: IConversation | undefined
}

export const getSendMessageMutationOptions = (): MutationOptions<
  ISendMessageReturnType,
  unknown,
  ISendMessageOptimisticallyParams,
  ISendMessageContext
> => {
  return {
    mutationFn: sendMessageOptimistically,
    onSuccess: async (optimisticMessages, variables) => {
      const currentSender = getSafeCurrentSender()

      // Add messages to the query cache
      for (const optimisticMessage of optimisticMessages) {
        setConversationMessageQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpMessageId: optimisticMessage.xmtpId,
          xmtpConversationId: variables.xmtpConversationId,
          message: optimisticMessage,
        })

        addMessagesToConversationMessagesInfiniteQueryData({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: variables.xmtpConversationId,
          messageIds: [optimisticMessage.xmtpId],
        })
      }

      // Message were well prepared, now send them to the network!
      publishXmtpConversationMessages({
        clientInboxId: currentSender.inboxId,
        conversationId: variables.xmtpConversationId,
      })
        .then(async () => {
          // In case stream didn't update the query cache, get the message from the network and update the query cache
          for (const optimisticMessage of optimisticMessages) {
            try {
              const messageInCache = getConversationMessageQueryData({
                clientInboxId: currentSender.inboxId,
                xmtpMessageId: optimisticMessage.xmtpId,
                xmtpConversationId: variables.xmtpConversationId,
              })

              if (!messageInCache) {
                throw new Error("Message not found in query cache")
              }

              if (messageInCache.status === "sent") {
                // It was already updated by the stream
                continue
              }

              await refetchConversationMessageQuery({
                clientInboxId: currentSender.inboxId,
                xmtpMessageId: optimisticMessage.xmtpId,
                xmtpConversationId: variables.xmtpConversationId,
              })
            } catch (error) {
              captureError(new ReactQueryError({ error }))
              invalidateConversationMessageQuery({
                clientInboxId: currentSender.inboxId,
                xmtpMessageId: optimisticMessage.xmtpId,
                xmtpConversationId: variables.xmtpConversationId,
              }).catch(captureError)
            }
          }
        })
        .catch((error) => {
          invalidateConversationMessagesInfiniteMessagesQuery({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId: variables.xmtpConversationId,
          }).catch(captureError)
          captureError(new ReactQueryError({ error }))
        })
    },
    onError: (_, variables, context) => {
      if (!context) {
        return
      }

      const currentSender = getSafeCurrentSender()

      invalidateConversationMessagesInfiniteMessagesQuery({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: variables.xmtpConversationId,
      }).catch(captureError)

      invalidateConversationQuery({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: variables.xmtpConversationId,
      }).catch(captureError)
    },
  }
}

export const sendMessageMutation = (args: ISendMessageOptimisticallyParams) => {
  return reactQueryClient
    .getMutationCache()
    .build(reactQueryClient, getSendMessageMutationOptions())
    .execute(args)
}

export function useSendMessage() {
  return useMutation(getSendMessageMutationOptions())
}
