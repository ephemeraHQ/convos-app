import { queryOptions, useQuery } from "@tanstack/react-query"
import { memo } from "react"
import { Image } from "@/design-system/image"
import { Text } from "@/design-system/Text"
import { ConversationAttachmentLoading } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-loading.component"
import { storeRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.storage"
import { ConversationMessageAttachmentContainer } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-message-attachment-container"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { translate } from "@/i18n"
import {
  IConversationMessageStaticAttachment,
  IConversationMessageStaticAttachmentContent,
} from "../conversation-message/conversation-message.types"

type IMessageStaticAttachmentProps = {
  message: IConversationMessageStaticAttachment
}

export const ConversationMessageStaticAttachment = memo(
  function ConversationMessageStaticAttachment({ message }: IMessageStaticAttachmentProps) {
    const content = message.content

    if (typeof content === "string") {
      // TODO
      return null
    }

    return <Content messageId={message.xmtpId} staticAttachment={content} />
  },
)

const Content = memo(function Content(props: {
  messageId: IXmtpMessageId
  staticAttachment: IConversationMessageStaticAttachmentContent
}) {
  const { messageId, staticAttachment } = props

  const {
    data: attachment,
    isLoading: attachmentLoading,
    error: attachmentError,
  } = useQuery(getStaticAttachmentQueryOptions({ messageId, staticAttachment }))

  if (!attachment && attachmentLoading) {
    return (
      <ConversationMessageAttachmentContainer>
        <ConversationAttachmentLoading />
      </ConversationMessageAttachmentContainer>
    )
  }

  if (attachmentError || !attachment) {
    return (
      <ConversationMessageAttachmentContainer>
        <Text>{translate("attachment_not_found")}</Text>
      </ConversationMessageAttachmentContainer>
    )
  }

  const aspectRatio = attachment.imageSize
    ? attachment.imageSize.width / attachment.imageSize.height
    : undefined

  return (
    <ConversationMessageAttachmentContainer style={{ aspectRatio }}>
      <Image
        source={{ uri: attachment.mediaURL }}
        contentFit="cover"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </ConversationMessageAttachmentContainer>
  )
})

function getStaticAttachmentQueryOptions(args: {
  messageId: IXmtpMessageId
  staticAttachment: IConversationMessageStaticAttachmentContent
}) {
  const { messageId, staticAttachment } = args

  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["static-attachment", messageId],
    queryFn: async () => {
      // TODO
      return storeRemoteAttachment({
        xmtpMessageId: messageId,
        decryptedAttachment: {
          fileUri: staticAttachment.data,
          filename: staticAttachment.filename,
          mimeType: staticAttachment.mimeType || "application/octet-stream",
        },
      })
    },
  })
}
