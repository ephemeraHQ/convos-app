import {
  conversationMessagesWithMetrics,
  findMessage,
  processMessage,
} from "@xmtp/react-native-sdk"
import {
  ISupportedXmtpCodecs,
  isXmtpGroupUpdatedContentType,
  isXmtpMultiRemoteAttachmentContentType,
  isXmtpReactionContentType,
  isXmtpRemoteAttachmentContentType,
  isXmtpReplyContentType,
  isXmtpStaticAttachmentContentType,
  isXmtpTextContentType,
} from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import {
  IXmtpConversationId,
  IXmtpDecodedGroupUpdatedMessage,
  IXmtpDecodedMessage,
  IXmtpDecodedMultiRemoteAttachmentMessage,
  IXmtpDecodedReactionMessage,
  IXmtpDecodedRemoteAttachmentMessage,
  IXmtpDecodedReplyMessage,
  IXmtpDecodedStaticAttachmentMessage,
  IXmtpDecodedTextMessage,
  IXmtpInboxId,
  IXmtpMessageId,
} from "../xmtp.types"

export async function getXmtpConversationMessages(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
  limit?: number
  afterNs?: number
  beforeNs?: number
  direction?: "next" | "prev"
}) {
  const { clientInboxId, conversationId, limit = 30, afterNs, beforeNs, direction = "next" } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const messagesWithMetrics = await wrapXmtpCallWithDuration("conversationMessages", () =>
      conversationMessagesWithMetrics<ISupportedXmtpCodecs>(
        installationId,
        conversationId,
        limit,
        beforeNs,
        afterNs,
        direction === "next" ? "DESCENDING" : "ASCENDING",
      ),
    )

    return messagesWithMetrics.messages.filter(isSupportedXmtpMessage)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error fetching messages for conversationId ${conversationId}`,
    })
  }
}

export async function getXmtpConversationMessage(args: {
  messageId: IXmtpMessageId
  clientInboxId: IXmtpInboxId
}) {
  const { messageId, clientInboxId } = args
  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const message = await wrapXmtpCallWithDuration("findMessage", () =>
      findMessage(installationId, messageId),
    )

    return message
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error finding message ${messageId}`,
    })
  }
}

export async function decryptXmtpMessage(args: {
  encryptedMessage: string
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { encryptedMessage, xmtpConversationId, clientInboxId } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const message = await wrapXmtpCallWithDuration("processMessage", () =>
      processMessage(installationId, xmtpConversationId, encryptedMessage),
    )

    return message
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error decrypting message for conversation ${xmtpConversationId}`,
    })
  }
}

export function getXmtpMessageIsTextMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedTextMessage {
  return isXmtpTextContentType(message.contentTypeId)
}

export function getXmtpMessageIsReactionMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedReactionMessage {
  return isXmtpReactionContentType(message.contentTypeId)
}

export function getXmtpMessageIsReplyMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedReplyMessage {
  return isXmtpReplyContentType(message.contentTypeId)
}

export function getXmtpMessageIsGroupUpdatedMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedGroupUpdatedMessage {
  return isXmtpGroupUpdatedContentType(message.contentTypeId)
}

export function getXmtpMessageIsMultiRemoteAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedMultiRemoteAttachmentMessage {
  return isXmtpMultiRemoteAttachmentContentType(message.contentTypeId)
}

export function getXmtpMessageIsStaticAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedStaticAttachmentMessage {
  return isXmtpStaticAttachmentContentType(message.contentTypeId)
}

export function getXmtpMessageIsRemoteAttachmentMessage(
  message: IXmtpDecodedMessage,
): message is IXmtpDecodedRemoteAttachmentMessage {
  return isXmtpRemoteAttachmentContentType(message.contentTypeId)
}
