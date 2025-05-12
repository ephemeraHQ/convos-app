import { Text } from "@design-system/Text"
import { translate } from "@i18n"
import React, { memo } from "react"
import { IImageProps, Image } from "@/design-system/image"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { AttachmentLoading } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-loading"
import { useRemoteAttachmentQuery } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.query"
import { useConversationAttachmentStyles } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.styles"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IConversationMessageRemoteAttachmentContent } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { Nullable } from "@/types/general"
import {
  ConversationMessageAttachmentContainer,
  IConversationMessageAttachmentContainerProps,
} from "./conversation-message-attachment-container"
import { VStack } from "@/design-system/VStack"
import { Icon } from "@/design-system/Icon/Icon"

type IConversationAttachmentRemoteImageProps = {
  imageUrl: Nullable<string>
  error: Nullable<Error>
  isLoading?: boolean
  fitAspectRatio?: boolean
  imageSize?: { width: number; height: number }
  containerProps?: IConversationMessageAttachmentContainerProps
  imageProps?: IImageProps
}

export const ConversationAttachmentRemoteImage = memo(function ConversationAttachmentRemoteImage(
  props: IConversationAttachmentRemoteImageProps,
) {
  const { 
    imageUrl, 
    isLoading, 
    error, 
    fitAspectRatio, 
    containerProps, 
    imageProps, 
    imageSize
  } = props

  const { borderRadius } = useConversationAttachmentStyles()

  if (isLoading) {
    return (
      <ConversationMessageAttachmentContainer {...containerProps}>
        <AttachmentLoading />
      </ConversationMessageAttachmentContainer>
    )
  }

  if (error || !imageUrl) {
    return (
      <ConversationMessageAttachmentContainer {...containerProps}>
        <VStack style={{ alignItems: "center", justifyContent: "center", height: "100%" }}>
          <Text>Couldn't load attachment</Text>
          <Text>Tap to retry</Text>
        </VStack>
      </ConversationMessageAttachmentContainer>
    )
  }

  const aspectRatio = fitAspectRatio && imageSize ? imageSize.width / imageSize.height : 1

  const { style, ...rest } = containerProps || {}
  const { style: imageStyle, ...restImageProps } = imageProps || {}

  return (
    <ConversationMessageAttachmentContainer style={[{ aspectRatio }, style]} {...rest}>
      <Image
        source={{ uri: imageUrl }}
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

export const ConversationAttachmentRemoteImageSmart = memo(
  function ConversationAttachmentRemoteImageSmart(
    props: {
      xmtpMessageId: IXmtpMessageId
    } & Partial<IConversationAttachmentRemoteImageProps>,
  ) {
    const { xmtpMessageId, ...rest } = props

    const currentSender = useSafeCurrentSender()

    const { data: conversationMessage } = useConversationMessageQuery({
      xmtpMessageId,
      clientInboxId: currentSender.inboxId,
      caller: "ConversationAttachmentRemoteImageSmart",
    })

    const { url, ...metadata } =
      (conversationMessage?.content as IConversationMessageRemoteAttachmentContent) || {}

    const {
      data: attachment,
      error: attachmentError,
      isLoading: attachmentLoading
    } = useRemoteAttachmentQuery({
      xmtpMessageId,
      url,
      metadata,
    })

    return (
      <ConversationAttachmentRemoteImage
        fitAspectRatio
        imageUrl={attachment?.mediaURL}
        error={attachmentError}
        isLoading={attachmentLoading}
        {...rest}
      />
    )
  },
)
