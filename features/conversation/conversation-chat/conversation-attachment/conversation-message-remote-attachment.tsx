import { memo, useCallback } from "react"
import { useGlobalMediaViewerStore } from "@/components/global-media-viewer/global-media-viewer.store"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationAttachmentRemoteImage } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-remote-image"
import { useRemoteAttachmentQuery } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.query"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { IConversationMessageRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useAppTheme } from "@/theme/use-app-theme"

type IMessageRemoteAttachmentProps = {
  message: IConversationMessageRemoteAttachment
}

export const ConversationMessageRemoteAttachment = memo(
  function ConversationMessageRemoteAttachment({ message }: IMessageRemoteAttachmentProps) {
    const { theme } = useAppTheme()

    const fromMe = messageIsFromCurrentSenderInboxId({ message })
    const currentSender = useSafeCurrentSender()

    const { displayName } = usePreferredDisplayInfo({
      inboxId: message.senderInboxId,
      caller: "ConversationMessageRemoteAttachment",
    })

    const {
      data: attachment,
      isLoading: attachmentLoading,
      error: attachmentError,
      refetch: refetchAttachment,
    } = useRemoteAttachmentQuery({
      xmtpMessageId: message.xmtpId,
      encryptedRemoteAttachmentContent: message.content,
      clientInboxId: currentSender.inboxId,
      xmtpConversationId: message.xmtpConversationId,
    })

    const handleTap = useCallback(() => {
      if (attachmentError || !attachment?.mediaURL) {
        refetchAttachment()
        return
      }

      useGlobalMediaViewerStore.getState().actions.openGlobalMediaViewer({
        uri: attachment.mediaURL,
        sender: displayName,
        timestamp: message.sentMs,
      })
    }, [attachment?.mediaURL, attachmentError, displayName, message.sentMs, refetchAttachment])

    return (
      <VStack
        // {...debugBorder("green")}
        style={{
          maxWidth: theme.layout.screen.width * 0.7,
          alignSelf: fromMe ? "flex-end" : "flex-start",
        }}
      >
        <ConversationMessageGestures onTap={handleTap}>
          <ConversationAttachmentRemoteImage
            imageUrl={attachment?.mediaURL}
            fitAspectRatio
            imageSize={attachment?.imageSize}
            error={attachmentError}
            isLoading={attachmentLoading}
          />
        </ConversationMessageGestures>
      </VStack>
    )
  },
)
