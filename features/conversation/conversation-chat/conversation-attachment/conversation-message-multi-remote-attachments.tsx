import { memo } from "react"
import { VStack } from "@/design-system/VStack"
import { AttachmentRemoteImage } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-remote-image"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { IConversationMessageMultiRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { useAppTheme } from "@/theme/use-app-theme"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"

type IMessageMultiRemoteAttachmentProps = {
  message: IConversationMessageMultiRemoteAttachment
}

export const MessageMultiRemoteAttachment = memo(function MessageMultiRemoteAttachment({
  message,
}: IMessageMultiRemoteAttachmentProps) {
  const { theme } = useAppTheme()

  const fromMe = messageIsFromCurrentSenderInboxId({ message })

  const content = message.content

  const { displayName } = usePreferredDisplayInfo({
    inboxId: message.senderInboxId,
  })

  if (typeof content === "string") {
    // TODO
    return null
  }

  return (
    <VStack
      style={{
        maxWidth: theme.layout.screen.width * 0.7,
        alignSelf: fromMe ? "flex-end" : "flex-start",
        rowGap: theme.spacing.xxs,
      }}
    >
      {content.attachments.map((attachment) => (
        <ConversationMessageGestures
          key={attachment.url}
          contextMenuExtra={{
            attachmentUrl: attachment.url,
          }}
        >
          <AttachmentRemoteImage
            xmtpMessageId={message.xmtpId}
            remoteMessageContent={attachment}
            fitAspectRatio
            senderName={fromMe ? "You" : displayName || "Sender"}
            sentTimestamp={message.sentMs}
          />
        </ConversationMessageGestures>
      ))}
    </VStack>
  )
})
