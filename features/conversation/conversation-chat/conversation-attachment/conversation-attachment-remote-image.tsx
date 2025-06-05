import { Text } from "@design-system/Text"
import React, { memo } from "react"
import { IImageProps, Image } from "@/design-system/image"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationAttachmentLoading } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-loading.component"
import { useRemoteAttachmentQuery } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.query"
import { useConversationAttachmentStyles } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.styles"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IConversationMessageRemoteAttachmentContent } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { Nullable } from "@/types/general"
import {
  ConversationMessageAttachmentContainer,
  IConversationMessageAttachmentContainerProps,
} from "./conversation-message-attachment-container"

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
  const { imageUrl, isLoading, error, fitAspectRatio, containerProps, imageProps, imageSize } =
    props

  const { borderRadius } = useConversationAttachmentStyles()

  if (isLoading) {
    return (
      <ConversationMessageAttachmentContainer {...containerProps}>
        <ConversationAttachmentLoading />
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
    const xmtpConversationId = useCurrentXmtpConversationIdSafe()

    const { data: conversationMessage } = useConversationMessageQuery({
      xmtpMessageId,
      xmtpConversationId,
      clientInboxId: currentSender.inboxId,
      caller: "ConversationAttachmentRemoteImageSmart",
    })

    const {
      data: attachment,
      error: attachmentError,
      isLoading: attachmentLoading,
    } = useRemoteAttachmentQuery({
      xmtpMessageId,
      encryptedRemoteAttachmentContent:
        conversationMessage?.content as IConversationMessageRemoteAttachmentContent,
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
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
