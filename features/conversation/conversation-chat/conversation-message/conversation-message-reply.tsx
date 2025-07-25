import { HStack } from "@design-system/HStack"
import { Icon } from "@design-system/Icon/Icon"
import { Text } from "@design-system/Text"
import { VStack } from "@design-system/VStack"
import { memo } from "react"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationAttachmentRemoteImageSmart } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment-remote-image"
import {
  BubbleContainer,
  BubbleContentContainer,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-bubble"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { ConversationMessageSimpleText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-simple-text"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import {
  isGroupUpdatedMessage,
  isMultiRemoteAttachmentMessage,
  isReactionMessage,
  isReadReceiptMessage,
  isRemoteAttachmentMessage,
  isReplyMessage,
  isStaticAttachmentMessage,
  isTextMessage,
  messageContentIsGroupUpdated,
  messageContentIsMultiRemoteAttachment,
  messageContentIsReaction,
  messageContentIsRemoteAttachment,
  messageContentIsReply,
  messageContentIsStaticAttachment,
  messageContentIsText,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  useConversationStore,
  useCurrentXmtpConversationIdSafe,
} from "@/features/conversation/conversation-chat/conversation.store-context"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useSelect } from "@/stores/stores.utils"
import { useAppTheme } from "@/theme/use-app-theme"
import { Haptics } from "@/utils/haptics"
import {
  IConversationMessage,
  IConversationMessageReply,
  IConversationMessageReplyContent,
} from "./conversation-message.types"

export const MessageReply = memo(function MessageReply(props: {
  message: IConversationMessageReply
}) {
  const { message } = props

  const { theme } = useAppTheme()

  const replyMessageContent = message.content

  if (!replyMessageContent) {
    // TODO
    return null
  }

  if (typeof replyMessageContent === "string") {
    // TODO. Render simple bubble message with the content?
    console.error("reply message is a string")
    return null
  }

  return (
    <BubbleContainer>
      <ConversationMessageGestures>
        <BubbleContentContainer>
          <VStack
            style={{
              rowGap: theme.spacing.xxs,
              marginTop: theme.spacing.xxxs, // Because for reply bubble we want the padding to be same for horizontal and vertial
            }}
          >
            <MessageReplyReference referenceMessageId={replyMessageContent.reference} />
            <MessageReplyContent replyMessageContent={replyMessageContent} />
          </VStack>
        </BubbleContentContainer>
      </ConversationMessageGestures>
    </BubbleContainer>
  )
})

// The content sent with the referenced message
const MessageReplyContent = memo(function MessageReplyContent(props: {
  replyMessageContent: IConversationMessageReplyContent
}) {
  const { replyMessageContent } = props
  const { theme } = useAppTheme()
  const { fromMe } = useConversationMessageContextSelector(useSelect(["fromMe"]))

  if (messageContentIsRemoteAttachment(replyMessageContent.content)) {
    return (
      <VStack
        style={{
          marginTop: theme.spacing.xxxs,
          marginBottom: theme.spacing.xxxs,
        }}
      >
        <ConversationAttachmentRemoteImageSmart
          xmtpMessageId={replyMessageContent.reference}
          containerProps={{
            style: {
              width: "100%",
              borderRadius:
                theme.borderRadius.message.attachment -
                theme.spacing.message.replyMessage.horizontalPadding / 2,
            },
          }}
        />
      </VStack>
    )
  }

  if (messageContentIsMultiRemoteAttachment(replyMessageContent.content)) {
    return (
      <VStack>
        <Text inverted={fromMe}>Multiple attachments</Text>
      </VStack>
    )
  }

  if (messageContentIsText(replyMessageContent.content)) {
    return (
      <ConversationMessageSimpleText inverted={fromMe}>
        {replyMessageContent.content.text}
      </ConversationMessageSimpleText>
    )
  }

  if (messageContentIsReply(replyMessageContent.content)) {
    return <RenderNestedReplyContent content={replyMessageContent.content} />
  }

  if (messageContentIsStaticAttachment(replyMessageContent.content)) {
    return <Text inverted={fromMe}>{replyMessageContent.content.filename}</Text>
  }

  // We can't reply to these
  if (
    messageContentIsReaction(replyMessageContent.content) ||
    messageContentIsGroupUpdated(replyMessageContent.content)
  ) {
    return null
  }

  const _exhaustiveCheck: never = replyMessageContent.content
  return <Text inverted={fromMe}>Unknown message content</Text>
})

// The message that is being replied to
const MessageReplyReference = memo(function MessageReplyReference(props: {
  referenceMessageId: IXmtpMessageId
}) {
  const { referenceMessageId } = props

  const { theme } = useAppTheme()

  const { fromMe } = useConversationMessageContextSelector(useSelect(["fromMe"]))
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const conversationStore = useConversationStore()
  const currentSender = useSafeCurrentSender()

  const { data: referencedMessage } = useConversationMessageQuery({
    xmtpMessageId: referenceMessageId,
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "MessageReplyReference",
  })

  const { displayName } = usePreferredDisplayInfo({
    inboxId: referencedMessage?.senderInboxId,
    caller: "MessageReplyReference",
  })

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      Haptics.softImpactAsync()
      conversationStore.setState({
        highlightedXmtpMessageId: referenceMessageId,
        scrollToXmtpMessageId: referenceMessageId,
      })
    })
    .maxDistance(10)
    .runOnJS(true)

  return (
    <GestureDetector gesture={tapGesture}>
      <VStack
        style={{
          rowGap: theme.spacing.xxxs,
          flex: 1,
          backgroundColor: fromMe
            ? theme.colors.bubbles.nestedReplyFromMe
            : theme.colors.bubbles.nestedReply,
          borderRadius:
            theme.borderRadius.message.bubble -
            theme.spacing.message.replyMessage.horizontalPadding / 2, // / 2 so the border fits the border radius of BubbleContentContainer
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xxs,
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
            color={fromMe ? theme.colors.text.inverted.secondary : theme.colors.text.secondary}
          />
          <Text preset="smaller" color="secondary" inverted={fromMe}>
            {displayName}
          </Text>
        </HStack>
        {!!referencedMessage && <MessageReplyReferenceContent replyMessage={referencedMessage} />}
      </VStack>
    </GestureDetector>
  )
})

const MessageReplyReferenceContent = memo(function ReplyMessageReferenceMessageContent(props: {
  replyMessage: IConversationMessage
}) {
  const { replyMessage } = props
  const { theme } = useAppTheme()
  const fromMe = useConversationMessageContextSelector((s) => s.fromMe)

  const attachmentContainerStyle = {
    height: theme.avatarSize.md,
    width: theme.avatarSize.md,
    marginBottom: theme.spacing.xxxs,
    borderRadius:
      theme.borderRadius.message.attachment - theme.spacing.message.replyMessage.horizontalPadding,
  }

  const attachmentImageStyle = {
    borderRadius:
      theme.borderRadius.message.attachment - theme.spacing.message.replyMessage.horizontalPadding,
  }

  // Handle read receipt messages
  if (isReadReceiptMessage(replyMessage)) {
    return null
  }

  // Handle remote attachment messages
  if (isRemoteAttachmentMessage(replyMessage)) {
    return (
      <ConversationAttachmentRemoteImageSmart
        xmtpMessageId={replyMessage.xmtpId}
        containerProps={{ style: attachmentContainerStyle, inverted: fromMe }}
        imageProps={{ style: attachmentImageStyle }}
      />
    )
  }

  // Handle text messages
  if (isTextMessage(replyMessage)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        {replyMessage.content.text}
      </Text>
    )
  }

  // Handle reaction messages
  if (isReactionMessage(replyMessage)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Reaction
      </Text>
    )
  }

  // Handle group updated messages
  if (isGroupUpdatedMessage(replyMessage)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Group updated
      </Text>
    )
  }

  // Handle static attachment messages
  if (isStaticAttachmentMessage(replyMessage)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        {replyMessage.content.filename}
      </Text>
    )
  }

  // Handle multi-remote attachment messages
  if (isMultiRemoteAttachmentMessage(replyMessage)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Multiple attachments
      </Text>
    )
  }

  // Handle reply messages
  if (isReplyMessage(replyMessage)) {
    const content = replyMessage.content

    // Handle remote attachment in the reply
    if (messageContentIsRemoteAttachment(content)) {
      return (
        <ConversationAttachmentRemoteImageSmart
          xmtpMessageId={replyMessage.xmtpId}
          containerProps={{ style: attachmentContainerStyle }}
        />
      )
    }

    // Handle text in the reply
    if (messageContentIsText(content)) {
      return (
        <Text numberOfLines={1} inverted={fromMe}>
          {content.text}
        </Text>
      )
    }

    // Handle static attachment in the reply
    if (messageContentIsStaticAttachment(content)) {
      return (
        <Text numberOfLines={1} inverted={fromMe}>
          {content.filename}
        </Text>
      )
    }

    // Handle group updates in the reply
    if (messageContentIsGroupUpdated(content)) {
      return (
        <Text numberOfLines={1} inverted={fromMe}>
          Group updated
        </Text>
      )
    }

    // Handle nested replies
    if (messageContentIsReply(content)) {
      return <RenderNestedReplyContent content={content} />
    }

    const _exhaustiveCheck: never = content
    throw new Error(`Unhandled message content type in reply: ${JSON.stringify(content, null, 2)}`)
  }

  const _exhaustiveCheck: never = replyMessage
  throw new Error(`Unhandled message type in reply: ${JSON.stringify(replyMessage, null, 2)}`)
})

const RenderNestedReplyContent = memo(function RenderNestedReplyContent(props: {
  content: IConversationMessageReplyContent
}) {
  const { content } = props

  const fromMe = useConversationMessageContextSelector((s) => s.fromMe)

  const nestedContent = content.content

  // Handle remote attachment in nested reply
  if (messageContentIsRemoteAttachment(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Image
      </Text>
    )
  }

  // Handle text in nested reply
  if (messageContentIsText(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        {nestedContent.text}
      </Text>
    )
  }

  // Handle static attachment in nested reply
  if (messageContentIsStaticAttachment(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        {nestedContent.filename}
      </Text>
    )
  }

  // Handle group updates in nested reply
  if (messageContentIsGroupUpdated(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Group updated
      </Text>
    )
  }

  // Handle another nested reply (deeper nesting)
  if (messageContentIsReply(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Replied message
      </Text>
    )
  }

  if (messageContentIsReaction(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Reaction
      </Text>
    )
  }

  if (messageContentIsMultiRemoteAttachment(nestedContent)) {
    return (
      <Text numberOfLines={1} inverted={fromMe}>
        Multiple attachments
      </Text>
    )
  }

  const _exhaustiveCheck: never = nestedContent

  // Default case for other content types
  return (
    <Text numberOfLines={1} inverted={fromMe}>
      Message
    </Text>
  )
})
