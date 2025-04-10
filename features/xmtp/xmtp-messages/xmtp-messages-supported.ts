import {
  isXmtpGroupUpdatedContentType,
  isXmtpReadReceiptContentType,
} from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { IXmtpDecodedGroupUpdatedMessage, IXmtpDecodedMessage } from "@/features/xmtp/xmtp.types"

export function isSupportedXmtpMessage(message: IXmtpDecodedMessage) {
  if (isXmtpReadReceiptContentType(message.contentTypeId)) {
    return false
  }

  if (
    isXmtpGroupUpdatedContentType(message.contentTypeId) &&
    xmtpMessageGroupUpdatedContentIsEmpty(message as IXmtpDecodedGroupUpdatedMessage)
  ) {
    return false
  }

  if (
    isXmtpGroupUpdatedContentType(message.contentTypeId) &&
    xmtpMessageIsDisappearingMessageFrom(message as IXmtpDecodedGroupUpdatedMessage)
  ) {
    return false
  }

  return true
}

function xmtpMessageGroupUpdatedContentIsEmpty(message: IXmtpDecodedGroupUpdatedMessage) {
  const content = message.content()
  return (
    content.membersAdded.length === 0 &&
    content.membersRemoved.length === 0 &&
    content.metadataFieldsChanged.length === 0
  )
}

function xmtpMessageIsDisappearingMessageFrom(message: IXmtpDecodedGroupUpdatedMessage) {
  return (
    isXmtpGroupUpdatedContentType(message.contentTypeId) &&
    message
      .content()
      .metadataFieldsChanged.some((field) => field.fieldName === "message_disappear_from_ns")
  )
}
