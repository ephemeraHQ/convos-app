import React, { memo, useCallback } from "react"
import { format } from "date-fns"
import { PressableScale } from "@/design-system/pressable-scale"
import { Image } from "@/design-system/image"
import { useRemoteAttachmentQuery } from "./conversation-attachment.query"
import { IConversationMessageRemoteAttachmentContent } from "../conversation-message/conversation-message.types"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { ConversationMessageAttachmentContainer } from "./conversation-message-attachment-container"
import { AttachmentLoading } from "./conversation-attachment-loading"
import { Text } from "@/design-system/Text"
import { translate } from "@/i18n"
import { openMediaViewer } from "../conversation-media-viewer/global-media-viewer"
import { ConversationMessageGestures } from "../conversation-message/conversation-message-gestures"

type IAttachmentRemoteImageViewerProps = {
  xmtpMessageId: IXmtpMessageId
  remoteMessageContent: IConversationMessageRemoteAttachmentContent
  senderName?: string
  sentTimestamp?: number
  fitAspectRatio?: boolean
}

export const AttachmentRemoteImageViewer = memo(function AttachmentRemoteImageViewer(
  props: IAttachmentRemoteImageViewerProps,
) {
  const {
    xmtpMessageId,
    remoteMessageContent,
    senderName = "Unknown",
    sentTimestamp,
    fitAspectRatio,
  } = props

  // Get media attachment data
  const {
    data: attachment,
    isLoading: attachmentLoading,
    error: attachmentError,
  } = useRemoteAttachmentQuery({
    xmtpMessageId,
    content: remoteMessageContent,
  })

  // Handler for opening the media viewer
  const handleOpenMediaViewer = useCallback(() => {
    if (attachment?.mediaURL) {
      openMediaViewer({
        uri: attachment.mediaURL,
        sender: senderName,
        timestamp: sentTimestamp,
      })
    }
  }, [attachment, senderName, sentTimestamp])

  // Loading state
  if (!attachment && attachmentLoading) {
    return (
      <ConversationMessageAttachmentContainer>
        <AttachmentLoading />
      </ConversationMessageAttachmentContainer>
    )
  }

  // Error state
  if (attachmentError || !attachment) {
    return (
      <ConversationMessageAttachmentContainer>
        <Text>{translate("attachment_message_error_download")}</Text>
      </ConversationMessageAttachmentContainer>
    )
  }

  // No media URL
  if (!attachment.mediaURL) {
    return (
      <ConversationMessageAttachmentContainer>
        <Text>{translate("attachment_message_error_download")}</Text>
      </ConversationMessageAttachmentContainer>
    )
  }

  // Unsupported media type
  if (attachment.mediaType === "UNSUPPORTED") {
    return (
      <ConversationMessageAttachmentContainer>
        <Text>{translate("attachment_message_view_in_browser")}</Text>
      </ConversationMessageAttachmentContainer>
    )
  }

  const aspectRatio =
    fitAspectRatio && attachment.imageSize
      ? attachment.imageSize.width / attachment.imageSize.height
      : undefined

  return (
    <ConversationMessageGestures
      contextMenuExtra={{
        attachmentUrl: attachment.mediaURL,
        openAttachmentViewer: handleOpenMediaViewer,
      }}
    >
      <ConversationMessageAttachmentContainer style={{ aspectRatio }}>
        <Image
          source={{ uri: attachment.mediaURL }}
          contentFit="cover"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
          }}
        />
      </ConversationMessageAttachmentContainer>
    </ConversationMessageGestures>
  )
}) 