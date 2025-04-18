import { Icon } from "@design-system/Icon/Icon"
import { PressableScale } from "@design-system/pressable-scale"
import { Text } from "@design-system/Text"
import { translate } from "@i18n"
import prettyBytes from "pretty-bytes"
import { memo } from "react"
import { IImageProps, Image } from "@/design-system/image"
import { AttachmentLoading } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-loading"
import { useConversationAttachmentStyles } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.styles"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { logJson } from "@/utils/logger/logger"
import { IConversationMessageRemoteAttachmentContent } from "../conversation-message/conversation-message.types"
import { useRemoteAttachmentQuery } from "./conversation-attachment.query"
import {
  ConversationMessageAttachmentContainer,
  IConversationMessageAttachmentContainerProps,
} from "./conversation-message-attachment-container"

type IAttachmentRemoteImageProps = {
  xmtpMessageId: IXmtpMessageId
  remoteMessageContent: IConversationMessageRemoteAttachmentContent
  fitAspectRatio?: boolean
  containerProps?: IConversationMessageAttachmentContainerProps
  imageProps?: IImageProps
}

export const AttachmentRemoteImage = memo(function AttachmentRemoteImage(
  props: IAttachmentRemoteImageProps,
) {
  const { xmtpMessageId, remoteMessageContent, fitAspectRatio, containerProps, imageProps } = props

  const { theme } = useAppTheme()

  const { borderRadius } = useConversationAttachmentStyles()

  const {
    data: attachment,
    isLoading: attachmentLoading,
    error: attachmentError,
    refetch: refetchAttachment,
  } = useRemoteAttachmentQuery({
    xmtpMessageId,
    content: remoteMessageContent,
  })

  if (!attachment && attachmentLoading) {
    return (
      <ConversationMessageAttachmentContainer {...containerProps}>
        <AttachmentLoading />
      </ConversationMessageAttachmentContainer>
    )
  }

  if (attachmentError || !attachment) {
    return (
      <ConversationMessageAttachmentContainer {...containerProps}>
        <Text>{translate("attachment_message_error_download")}</Text>
      </ConversationMessageAttachmentContainer>
    )
  }

  if (!attachment.mediaURL) {
    return (
      <PressableScale onPress={() => refetchAttachment()}>
        <ConversationMessageAttachmentContainer {...containerProps}>
          <Icon icon="arrow.down" size={14} color="white" />
          <Text inverted weight="bold">
            {prettyBytes(attachment.contentLength)}
          </Text>
        </ConversationMessageAttachmentContainer>
      </PressableScale>
    )
  }

  // TODO: FIX
  // if (attachment.mediaType === "UNSUPPORTED") {
  //   return (
  //     <PressableScale
  //       onPress={() => {
  //         // Open in browser
  //       }}
  //     >
  //       <ConversationMessageAttachmentContainer {...containerProps}>
  //         <Text
  //           style={{
  //             textDecorationLine: "underline",
  //           }}
  //         >
  //           {translate("attachment_message_view_in_browser")}
  //         </Text>
  //       </ConversationMessageAttachmentContainer>
  //     </PressableScale>
  //   )
  // }

  const aspectRatio =
    fitAspectRatio && attachment.imageSize
      ? attachment.imageSize.width / attachment.imageSize.height
      : 1

  const { style, ...rest } = containerProps || {}
  const { style: imageStyle, ...restImageProps } = imageProps || {}

  return (
    <ConversationMessageAttachmentContainer style={[{ aspectRatio }, style]} {...rest}>
      <Image
        source={{ uri: attachment.mediaURL }}
        contentFit="cover"
        style={[
          {
            width: "100%",
            height: "100%",
            borderRadius,
          },
          imageStyle,
        ]}
        {...restImageProps}
      />
    </ConversationMessageAttachmentContainer>
  )
})
