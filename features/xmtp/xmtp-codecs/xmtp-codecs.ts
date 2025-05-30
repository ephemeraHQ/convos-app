import {
  GroupUpdatedCodec,
  MultiRemoteAttachmentCodec,
  ReactionCodec,
  // ReadReceiptCodec,
  RemoteAttachmentCodec,
  ReplyCodec,
  StaticAttachmentCodec,
  TextCodec,
} from "@xmtp/react-native-sdk"
import {
  IXmtpDecodedGroupUpdatedMessage,
  IXmtpDecodedMessage,
  IXmtpDecodedMultiRemoteAttachmentMessage,
  IXmtpDecodedReactionMessage,
  IXmtpDecodedRemoteAttachmentMessage,
  IXmtpDecodedReplyMessage,
  IXmtpDecodedStaticAttachmentMessage,
  IXmtpDecodedTextMessage,
} from "../xmtp.types"

export const supportedXmtpCodecs = [
  new TextCodec(),
  new ReactionCodec(),
  new GroupUpdatedCodec(),
  new ReplyCodec(),
  new RemoteAttachmentCodec(),
  new StaticAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  // new ReadReceiptCodec(),
]

export type ISupportedXmtpCodecs = typeof supportedXmtpCodecs

export function buildCodecContentType(codec: ISupportedXmtpCodecs[number]) {
  return `${codec.contentType.authorityId}/${codec.contentType.typeId}:${codec.contentType.versionMajor}.${codec.contentType.versionMinor}`
}

export function isSupportedXmtpContentType(contentType: string) {
  return supportedXmtpCodecs.some((codec) => {
    return contentType === buildCodecContentType(codec)
  })
}

// Text content type
export function isXmtpTextContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/text:")
}

// Remote attachment content type
export function isXmtpRemoteAttachmentContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/remoteStaticAttachment:")
}

// Static attachment content type
export function isXmtpStaticAttachmentContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/attachment:")
}

// Reaction content type
export function isXmtpReactionContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/reaction:")
}

// Reply content type
export function isXmtpReplyContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/reply:")
}

// Read receipt content type
export function isXmtpReadReceiptContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/readReceipt:")
}

// Group updated content type
export function isXmtpGroupUpdatedContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/group_updated:")
}

// Multi remote attachment content type
export function isXmtpMultiRemoteAttachmentContentType(contentType: string) {
  return contentType.startsWith("xmtp.org/multiRemoteStaticAttachment:")
}

export function isXmtpTextMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedTextMessage {
  return (
    isXmtpTextContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    typeof message.nativeContent.text === "string"
  )
}

export function isXmtpReactionMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedReactionMessage {
  return (
    isXmtpReactionContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    (message.nativeContent.reaction != null || message.nativeContent.reactionV2 != null)
  )
}

export function isXmtpGroupUpdatedMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedGroupUpdatedMessage {
  return (
    isXmtpGroupUpdatedContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    message.nativeContent.groupUpdated != null &&
    typeof message.nativeContent.groupUpdated.initiatedByInboxId === "string" &&
    Array.isArray(message.nativeContent.groupUpdated.membersAdded) &&
    Array.isArray(message.nativeContent.groupUpdated.membersRemoved) &&
    Array.isArray(message.nativeContent.groupUpdated.metadataFieldsChanged)
  )
}

export function isXmtpReplyMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedReplyMessage {
  return (
    isXmtpReplyContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    message.nativeContent.reply != null &&
    typeof message.nativeContent.reply.reference === "string" &&
    message.nativeContent.reply.content != null
  )
}

export function isXmtpRemoteAttachmentMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedRemoteAttachmentMessage {
  return (
    isXmtpRemoteAttachmentContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    message.nativeContent.remoteAttachment != null &&
    typeof message.nativeContent.remoteAttachment.url === "string" &&
    typeof message.nativeContent.remoteAttachment.contentDigest === "string" &&
    typeof message.nativeContent.remoteAttachment.secret === "string" &&
    typeof message.nativeContent.remoteAttachment.salt === "string" &&
    typeof message.nativeContent.remoteAttachment.nonce === "string"
  )
}

export function isXmtpStaticAttachmentMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedStaticAttachmentMessage {
  return (
    isXmtpStaticAttachmentContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    message.nativeContent.attachment != null &&
    typeof message.nativeContent.attachment.filename === "string" &&
    typeof message.nativeContent.attachment.mimeType === "string" &&
    typeof message.nativeContent.attachment.data === "string"
  )
}

export function isXmtpMultiRemoteAttachmentMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedMultiRemoteAttachmentMessage {
  return (
    isXmtpMultiRemoteAttachmentContentType(message.contentTypeId) &&
    message.nativeContent != null &&
    message.nativeContent.multiRemoteAttachment != null &&
    Array.isArray(message.nativeContent.multiRemoteAttachment.attachments) &&
    message.nativeContent.multiRemoteAttachment.attachments.length > 0 &&
    message.nativeContent.multiRemoteAttachment.attachments.every(
      (attachment) =>
        typeof attachment.url === "string" &&
        typeof attachment.contentDigest === "string" &&
        typeof attachment.secret === "string" &&
        typeof attachment.salt === "string" &&
        typeof attachment.nonce === "string" &&
        typeof attachment.contentLength === "string",
    )
  )
}

export function isXmtpMessage(
  message: Pick<IXmtpDecodedMessage, "contentTypeId" | "nativeContent">,
): message is IXmtpDecodedMessage {
  return (
    isXmtpTextMessage(message) ||
    isXmtpReactionMessage(message) ||
    isXmtpGroupUpdatedMessage(message) ||
    isXmtpReplyMessage(message) ||
    isXmtpRemoteAttachmentMessage(message) ||
    isXmtpStaticAttachmentMessage(message) ||
    isXmtpMultiRemoteAttachmentMessage(message)
  )
}
