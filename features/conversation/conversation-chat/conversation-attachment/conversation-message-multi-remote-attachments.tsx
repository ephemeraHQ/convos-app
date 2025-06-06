import { memo, useCallback } from "react"
import { useGlobalMediaViewerStore } from "@/components/global-media-viewer/global-media-viewer.store"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationAttachmentRemoteImage } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-remote-image"
import { useRemoteAttachmentQuery } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.query"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import {
  IConversationMessageMultiRemoteAttachment,
  IConversationMessageRemoteAttachmentContent,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"

type IMessageMultiRemoteAttachmentProps = {
  message: IConversationMessageMultiRemoteAttachment
}

export const ConversationMessageMultiRemoteAttachment = memo(
  function ConversationMessageMultiRemoteAttachment({
    message,
  }: IMessageMultiRemoteAttachmentProps) {
    const { theme } = useAppTheme()

    const fromMe = messageIsFromCurrentSenderInboxId({ message })

    return (
      <VStack
        style={{
          maxWidth: theme.layout.screen.width * 0.7,
          alignSelf: fromMe ? "flex-end" : "flex-start",
          rowGap: theme.spacing.xxs,
        }}
      >
        {message.content.attachments.map((attachment) => (
          <SingleAttachmentDisplay
            key={attachment.url}
            attachment={attachment}
            xmtpMessageId={message.xmtpId}
            senderInboxId={message.senderInboxId}
            sentMs={message.sentMs}
          />
        ))}
      </VStack>
    )
  },
)

type ISingleAttachmentDisplayProps = {
  attachment: IConversationMessageRemoteAttachmentContent
  xmtpMessageId: string
  senderInboxId: string
  sentMs: number
}

const SingleAttachmentDisplay = memo(function SingleAttachmentDisplay({
  attachment,
  xmtpMessageId,
  senderInboxId,
  sentMs,
}: ISingleAttachmentDisplayProps) {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { displayName } = usePreferredDisplayInfo({
    inboxId: senderInboxId as IXmtpInboxId,
    caller: "SingleAttachmentDisplay",
  })

  const {
    data: decryptedAttachment,
    isLoading: attachmentLoading,
    error: attachmentError,
  } = useRemoteAttachmentQuery({
    xmtpMessageId: xmtpMessageId as IXmtpMessageId,
    encryptedRemoteAttachmentContent: attachment,
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const handleTap = useCallback(() => {
    if (decryptedAttachment?.mediaURL) {
      useGlobalMediaViewerStore.getState().actions.openGlobalMediaViewer({
        uri: decryptedAttachment?.mediaURL,
        sender: displayName,
        timestamp: sentMs,
      })
    }
  }, [decryptedAttachment?.mediaURL, displayName, sentMs])

  return (
    <ConversationMessageGestures onTap={handleTap}>
      <ConversationAttachmentRemoteImage
        imageUrl={decryptedAttachment?.mediaURL}
        fitAspectRatio
        imageSize={decryptedAttachment?.imageSize}
        error={attachmentError}
        isLoading={attachmentLoading}
      />
    </ConversationMessageGestures>
  )
})
