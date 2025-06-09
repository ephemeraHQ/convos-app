import { MutationOptions, useMutation } from "@tanstack/react-query"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { messageContentIsReply } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { getMessageTypeBaseOnContent } from "@/features/conversation/conversation-chat/conversation-message/utils/get-message-type-based-on-content"
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
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { ensureOurError, GenericError } from "@/utils/error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import {
  IConversationMessage,
  IConversationMessageContent,
  IConversationMessageContentType,
} from "../conversation-chat/conversation-message/conversation-message.types"
import { IConversation } from "../conversation.types"

export type ISendMessageOptimisticallyParams = {
  xmtpConversationId: IXmtpConversationId
  contents: IConversationMessageContent[] // Array because we can send text at same time as attachments for example
}

// type ISentOptimisticMessage = IConversationMessage & {
//   status: "sending"
// }

export type ISendMessageReturnType = Awaited<ReturnType<typeof sendMessageOptimistically>>

const messageTypeOrder: IConversationMessageContentType[] = [
  "remoteAttachment",
  "staticAttachment",
  "multiRemoteAttachment",
  "text",
  "reply",
]

export async function sendMessageOptimistically(args: ISendMessageOptimisticallyParams) {
  const { contents, xmtpConversationId } = args

  const currentSender = getSafeCurrentSender()

  const sendOptimisticMessageIds: IXmtpMessageId[] = []

  // Sort contents based on their type
  const sortedContents = [...contents].sort((a, b) => {
    const typeA = getMessageTypeBaseOnContent({ content: a })
    const typeB = getMessageTypeBaseOnContent({ content: b })
    return messageTypeOrder.indexOf(typeA) - messageTypeOrder.indexOf(typeB)
  })

  const errors: Error[] = []

  // Send each content as a separate message and do in sync to keep the order
  for (const content of sortedContents) {
    try {
      let sentXmtpMessageId: IXmtpMessageId

      const payload = convertConvosMessageContentToXmtpMessageContent(content)

      if (messageContentIsReply(content)) {
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
        sentXmtpMessageId = await sendXmtpConversationMessageOptimistic({
          clientInboxId: currentSender.inboxId,
          conversationId: xmtpConversationId,
          content: payload,
        })
      }

      sendOptimisticMessageIds.push(sentXmtpMessageId)
    } catch (error) {
      errors.push(ensureOurError(error))
    }
  }

  if (sendOptimisticMessageIds.length === 0) {
    throw new GenericError({
      error: errors[0],
      additionalMessage: "Failed to send all messages",
    })
  }

  if (errors.length > 0) {
    errors.forEach((error) =>
      captureError(
        new GenericError({
          error,
          additionalMessage: "Failed to send some messages",
        }),
      ),
    )
  }

  return sendOptimisticMessageIds
}

export async function handleCreatedOptimisticMessageIdsForConversation(args: {
  optimisticMessageIds: IXmtpMessageId[]
  xmtpConversationId: IXmtpConversationId
}) {
  const { optimisticMessageIds, xmtpConversationId } = args

  const currentSender = getSafeCurrentSender()

  // Publish messages to the network
  try {
    await publishXmtpConversationMessages({
      clientInboxId: currentSender.inboxId,
      conversationId: xmtpConversationId,
    })
  } catch (error) {
    captureErrorWithToast(
      new GenericError({
        error,
        additionalMessage: "Failed to publish messages",
      }),
      {
        message: "Message will send when reconnected",
      },
    )
  }

  const fullSentMessages = (
    await Promise.all(
      optimisticMessageIds.map(async (optimisticMessageId) => {
        return getXmtpConversationMessage({
          messageId: optimisticMessageId,
          clientInboxId: currentSender.inboxId,
        })
      }),
    )
  ).filter(Boolean)

  const publishedConvosMessages = fullSentMessages.map(convertXmtpMessageToConvosMessage)

  // Add messages to the query cache
  for (const publishedConvosMessage of publishedConvosMessages) {
    setConversationMessageQueryData({
      clientInboxId: currentSender.inboxId,
      xmtpMessageId: publishedConvosMessage.xmtpId,
      xmtpConversationId,
      message: publishedConvosMessage,
    })
  }

  addMessagesToConversationMessagesInfiniteQueryData({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    messageIds: publishedConvosMessages.map((message) => message.xmtpId),
  })
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
    onSuccess: (optimisticMessageIds, variables) => {
      handleCreatedOptimisticMessageIdsForConversation({
        optimisticMessageIds: optimisticMessageIds,
        xmtpConversationId: variables.xmtpConversationId,
      }).catch(captureError)
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
