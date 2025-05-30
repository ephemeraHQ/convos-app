import { MessageDeliveryStatus } from "@xmtp/react-native-sdk"
import {
  IConversationMessage,
  IConversationMessageBase,
  IConversationMessageGroupUpdated,
  IConversationMessageReaction,
  IConversationMessageReply,
  IConversationMessageStatus,
  IConversationMessageText,
  IGroupUpdatedMetadataEntryFieldName,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import {
  isXmtpGroupUpdatedMessage,
  isXmtpMessage,
  isXmtpMultiRemoteAttachmentMessage,
  isXmtpReactionMessage,
  isXmtpRemoteAttachmentMessage,
  isXmtpReplyMessage,
  isXmtpStaticAttachmentMessage,
  isXmtpTextMessage,
} from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { IXmtpDecodedMessage, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { GenericError } from "@/utils/error"
import { convertXmtpReplyContentToConvosContent } from "./convert-xmtp-reply-content-to-convos-content"

export function convertXmtpMessageToConvosMessage(
  message: IXmtpDecodedMessage,
): IConversationMessage {
  const baseMessage = {
    xmtpId: message.id,
    xmtpTopic: message.topic,
    xmtpConversationId: getXmtpConversationIdFromXmtpTopic(message.topic),
    status: getConvosMessageStatusForXmtpMessage(message),
    senderInboxId: message.senderInboxId as unknown as IXmtpInboxId,
    sentNs: message.sentNs,
    sentMs: convertNanosecondsToMilliseconds(message.sentNs),
  } satisfies IConversationMessageBase

  if (!isXmtpMessage(message)) {
    captureError(
      new GenericError({
        error: new Error(
          `Trying to convert a message that isn't an XMTP message to a ConvoMessage ${JSON.stringify(message)}`,
        ),
      }),
    )
  }

  // Handle fallback case
  if (!message.nativeContent) {
    const textMessage: IConversationMessageText = {
      ...baseMessage,
      type: "text",
      content: { text: message.fallback ?? "" },
    }
    return textMessage
  }

  // Use type-checking functions to determine message type and create appropriate message
  if (isXmtpTextMessage(message)) {
    return {
      ...baseMessage,
      type: "text",
      content: {
        text:
          message.nativeContent.text ||
          // The message content coming from ios notification extension puts the text directly in the content
          (message.nativeContent as unknown as string),
      },
    } satisfies IConversationMessageText
  }

  if (isXmtpReactionMessage(message)) {
    const reactionContent = message.nativeContent.reaction || message.nativeContent.reactionV2
    return {
      ...baseMessage,
      type: "reaction",
      content: {
        reference: reactionContent!.reference as unknown as IXmtpMessageId,
        action: reactionContent!.action ?? "unknown",
        schema: reactionContent!.schema ?? "unknown",
        content: reactionContent!.content ?? "",
      },
    } satisfies IConversationMessageReaction
  }

  if (isXmtpReplyMessage(message)) {
    return {
      ...baseMessage,
      type: "reply",
      content: {
        reference: message.nativeContent.reply.reference as unknown as IXmtpMessageId,
        content: convertXmtpReplyContentToConvosContent(message.nativeContent.reply.content),
      },
    } satisfies IConversationMessageReply
  }

  if (isXmtpGroupUpdatedMessage(message)) {
    return {
      ...baseMessage,
      type: "groupUpdated",
      content: {
        initiatedByInboxId: message.nativeContent.groupUpdated
          .initiatedByInboxId as unknown as IXmtpInboxId,
        membersAdded: message.nativeContent.groupUpdated.membersAdded.map((member) => ({
          inboxId: member.inboxId as unknown as IXmtpInboxId,
        })),
        membersRemoved: message.nativeContent.groupUpdated.membersRemoved.map((member) => ({
          inboxId: member.inboxId as unknown as IXmtpInboxId,
        })),
        metadataFieldsChanged: message.nativeContent.groupUpdated.metadataFieldsChanged.map(
          (field) => ({
            oldValue: field.oldValue,
            newValue: field.newValue,
            fieldName: field.fieldName as IGroupUpdatedMetadataEntryFieldName,
          }),
        ),
      },
    } satisfies IConversationMessageGroupUpdated
  }

  if (isXmtpRemoteAttachmentMessage(message)) {
    return {
      ...baseMessage,
      type: "remoteAttachment",
      content: {
        ...message.nativeContent.remoteAttachment,
        contentLength: message.nativeContent.remoteAttachment.contentLength ?? "0",
      },
    }
  }

  if (isXmtpStaticAttachmentMessage(message)) {
    return {
      ...baseMessage,
      type: "staticAttachment",
      content: message.nativeContent.attachment,
    }
  }

  if (isXmtpMultiRemoteAttachmentMessage(message)) {
    return {
      ...baseMessage,
      type: "multiRemoteAttachment",
      content: message.nativeContent.multiRemoteAttachment,
    }
  }

  const _exhaustiveCheck: never = message
  throw new Error(
    `Unhandled message type to convert from XMTP to ConvoMessage ${JSON.stringify(message)}`,
  )
}

export function getConvosMessageStatusForXmtpMessage(
  message: IXmtpDecodedMessage,
): IConversationMessageStatus {
  // @ts-ignore - Custom for optimistic message, we might want to have our custom ConvoMessage
  if (message.deliveryStatus === "sending") {
    return "sending"
  }

  switch (message.deliveryStatus) {
    case MessageDeliveryStatus.UNPUBLISHED:
      return "sending"
    case MessageDeliveryStatus.FAILED:
      return "error"
    case MessageDeliveryStatus.PUBLISHED:
    case MessageDeliveryStatus.ALL:
      return "sent"
    default:
      throw new Error(`Unhandled delivery status: ${message.deliveryStatus}`)
  }
}
