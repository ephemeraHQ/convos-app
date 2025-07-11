import { HStack } from "@design-system/HStack"
import { Icon } from "@design-system/Icon/Icon"
import { IconButton } from "@design-system/IconButton/IconButton"
import { Text } from "@design-system/Text"
import { AnimatedVStack, VStack } from "@design-system/VStack"
import { Haptics } from "@utils/haptics"
import { memo, useCallback, useEffect, useState } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  isGroupUpdatedMessage,
  isReactionMessage,
  isReadReceiptMessage,
  isRemoteAttachmentMessage,
  isReplyMessage,
  isStaticAttachmentMessage,
  messageContentIsGroupUpdated,
  messageContentIsMultiRemoteAttachment,
  messageContentIsRemoteAttachment,
  messageContentIsReply,
  messageContentIsStaticAttachment,
  messageContentIsText,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { ConversationAttachmentRemoteImageSmart } from "../conversation-attachment/conversation-attachment-remote-image"
import { ensureConversationMessageQueryData } from "../conversation-message/conversation-message.query"
import {
  IConversationMessage,
  IConversationMessageReply,
  IConversationMessageStaticAttachment,
} from "../conversation-message/conversation-message.types"
import { useCurrentXmtpConversationId } from "../conversation.store-context"
import { useConversationComposerStore } from "./conversation-composer.store-context"

export const ConversationComposerReplyPreview = memo(function ReplyPreview() {
  const xmtpConversationId = useCurrentXmtpConversationId()

  if (!xmtpConversationId) {
    return null
  }

  return <ConversationComposerReplyPreviewContent xmtpConversationId={xmtpConversationId} />
})

const ConversationComposerReplyPreviewContent = memo(
  function ConversationComposerReplyPreviewContent(props: {
    xmtpConversationId: IXmtpConversationId
  }) {
    const { xmtpConversationId } = props

    const { theme } = useAppTheme()

    const composerStore = useConversationComposerStore()

    const [replyMessage, setReplyMessage] = useState<IConversationMessage | null>(null)

    // Listen for when we have a replyMessageId in the composer store
    useEffect(() => {
      const sub = composerStore.subscribe(
        (state) => state.replyingToMessageId,
        async (replyingToMessageId) => {
          if (!replyingToMessageId) {
            setReplyMessage(null)
            return
          }

          try {
            const currentSender = getSafeCurrentSender()
            const message = await ensureConversationMessageQueryData({
              xmtpConversationId,
              xmtpMessageId: replyingToMessageId,
              clientInboxId: currentSender.inboxId,
              caller: "ConversationComposerReplyPreview",
            })
            Haptics.softImpactAsync()
            setReplyMessage(message)
          } catch (error) {
            captureErrorWithToast(
              new GenericError({
                error,
                additionalMessage: "Failed to load reply message",
              }),
              {
                message: "Failed to load reply message",
              },
            )
          }
        },
      )

      return sub
    }, [composerStore, xmtpConversationId])

    const { displayName } = usePreferredDisplayInfo({
      inboxId: replyMessage?.senderInboxId,
      caller: "ConversationComposerReplyPreview",
    })

    const replyingTo = replyMessage
      ? messageIsFromCurrentSenderInboxId({ message: replyMessage })
        ? `Replying to you`
        : displayName
          ? `Replying to ${displayName}`
          : "Replying"
      : ""

    const handleDismiss = useCallback(() => {
      composerStore.getState().setReplyToMessageId(null)
    }, [composerStore])

    return (
      <AnimatedVStack
        style={{
          overflow: "hidden",
        }}
      >
        {!!replyMessage && (
          <AnimatedVStack
            entering={theme.animation.reanimatedFadeInSpring}
            exiting={theme.animation.reanimatedFadeOutSpring}
            style={{
              borderTopWidth: theme.borderWidth.xs,
              borderTopColor: theme.colors.border.subtle,
              paddingLeft: theme.spacing.sm,
              paddingRight: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.xxxs,
              backgroundColor: theme.colors.background.surfaceless,
              minHeight: replyMessage
                ? 56 // Value from Figma. Not the best but we need minHeight for this to work. If the content end up being bigger it will adjust automatically
                : 0,
            }}
          >
            <HStack
              style={{
                // ...debugBorder("blue"),
                alignItems: "center",
                columnGap: theme.spacing.xs,
              }}
            >
              <VStack
                style={{
                  rowGap: theme.spacing.xxxs,
                  flex: 1,
                }}
              >
                <HStack
                  style={{
                    alignItems: "center",
                    columnGap: theme.spacing.xxxs,
                  }}
                >
                  <Icon
                    size={theme.iconSize.xxs}
                    icon="arrowshape.turn.up.left.fill"
                    color={theme.colors.text.secondary}
                  />
                  <Text preset="smaller" color="secondary">
                    {replyingTo}
                  </Text>
                </HStack>
                {!!replyMessage && <ReplyPreviewMessageContent replyMessage={replyMessage} />}
              </VStack>
              <ReplyPreviewEndContent replyMessage={replyMessage} />
              <IconButton iconName="xmark" onPress={handleDismiss} hitSlop={8} size="sm" />
            </HStack>
          </AnimatedVStack>
        )}
      </AnimatedVStack>
    )
  },
)

const ReplyPreviewEndContent = memo(function ReplyPreviewEndContent(props: {
  replyMessage: IConversationMessage
}) {
  const { replyMessage } = props

  const { theme } = useAppTheme()

  if (isReplyMessage(replyMessage)) {
    const content = replyMessage.content

    if (messageContentIsText(content.content)) {
      return null
    }

    if (messageContentIsRemoteAttachment(content.content)) {
      return (
        <ConversationAttachmentRemoteImageSmart
          xmtpMessageId={content.reference as IXmtpMessageId}
          containerProps={{
            style: {
              height: theme.avatarSize.md,
              width: theme.avatarSize.md,
              borderRadius: theme.borderRadius.xxs,
            },
          }}
        />
      )
    }
  }

  if (isRemoteAttachmentMessage(replyMessage)) {
    return (
      <ConversationAttachmentRemoteImageSmart
        xmtpMessageId={replyMessage.xmtpId}
        containerProps={{
          style: {
            height: theme.avatarSize.md,
            width: theme.avatarSize.md,
            borderRadius: theme.borderRadius.xxs,
          },
        }}
      />
    )
  }

  return null
})

const ReplyPreviewMessageContent = memo(function ReplyPreviewMessageContent(props: {
  replyMessage: IConversationMessage
}) {
  const { replyMessage } = props

  const messageText = useMessageContentStringValue(replyMessage)
  const clearedMessage = messageText?.replace(/(\n)/gm, " ")

  if (isStaticAttachmentMessage(replyMessage)) {
    const messageTyped = replyMessage as IConversationMessageStaticAttachment

    const content = messageTyped.content

    if (typeof content === "string") {
      return <Text>{content}</Text>
    }

    // TODO
    return <Text>Static attachment</Text>
  }

  if (isReactionMessage(replyMessage)) {
    return <Text>Reaction</Text>
  }

  if (isReadReceiptMessage(replyMessage)) {
    return <Text>Read Receipt</Text>
  }

  if (isGroupUpdatedMessage(replyMessage)) {
    return <Text>Group updates</Text>
  }

  if (isRemoteAttachmentMessage(replyMessage)) {
    return <Text>Remote Attachment</Text>
  }

  if (isReplyMessage(replyMessage)) {
    replyMessage.content.content
    const messageTyped = replyMessage as IConversationMessageReply
    const content = messageTyped.content

    if (messageContentIsStaticAttachment(content.content)) {
      return <Text>Reply with attachment</Text>
    }

    if (messageContentIsText(content.content)) {
      return <Text>{content.content.text}</Text>
    }

    if (messageContentIsRemoteAttachment(content.content)) {
      return <Text>{content.content.filename}</Text>
    }

    if (messageContentIsMultiRemoteAttachment(content.content)) {
      return <Text>Multi remote attachment</Text>
    }

    if (messageContentIsGroupUpdated(content.content)) {
      return <Text>Group updated</Text>
    }

    if (messageContentIsReply(content.content)) {
      return <Text>Reply</Text>
    }

    return <Text>Reply</Text>
  }

  return <Text numberOfLines={1}>{clearedMessage}</Text>
})
