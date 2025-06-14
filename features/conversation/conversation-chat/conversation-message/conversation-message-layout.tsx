import { Fragment, memo, ReactNode, useMemo } from "react"
import { StyleProp, ViewStyle } from "react-native"
import { HStack } from "@/design-system/HStack"
import { VStack } from "@/design-system/VStack"
import { ConversationSenderAvatar } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-sender-avatar"
import { ConversationMessageSenderName } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-sender-name"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessageStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.styles"

export const ConversationMessageLayout = memo(function ConversationMessageLayout(args: {
  reactionsComp?: ReactNode
  messageComp?: ReactNode
  messageStatusComp?: ReactNode
}) {
  const { reactionsComp, messageComp, messageStatusComp } = args
  const messageStyles = useConversationMessageLayoutStyles()

  const hasPreviousMessageInSeries = useConversationMessageContextSelector(
    (s) => s.hasPreviousMessageInSeries,
  )
  const hasNextMessageInSeries = useConversationMessageContextSelector(
    (s) => s.hasNextMessageInSeries,
  )
  const fromMe = useConversationMessageContextSelector((s) => s.fromMe)
  const isGroupUpdate = useConversationMessageContextSelector((s) => s.isGroupUpdateMessage)

  const contentContainerStyle = useMemo(() => {
    return fromMe
      ? messageStyles.hStackFromMe
      : isGroupUpdate
        ? messageStyles.hStackBase
        : messageStyles.hStackFromOther
  }, [fromMe, isGroupUpdate, messageStyles])

  const messageContainerStyle = useMemo(() => {
    return [
      messageStyles.messageContainer,
      {
        alignItems: fromMe ? "flex-end" : "flex-start",
        ...(Boolean(reactionsComp) && {
          marginBottom: messageStyles.spaceBetweenMessagesInSeries,
        }),
      },
    ] as StyleProp<ViewStyle>
  }, [fromMe, reactionsComp, messageStyles])

  const senderNameContainerStyle = useMemo(() => {
    return {
      flexDirection: "row" as const,
      marginLeft: messageStyles.senderNameLeftMargin,
      marginBottom: messageStyles.spaceBetweenMessageAndSender,
    }
  }, [messageStyles])

  const reactionsContainerStyle = useMemo(() => {
    return fromMe ? messageStyles.reactionsFromMe : messageStyles.reactionsFromOther
  }, [fromMe, messageStyles])

  return (
    <ConversationMessageLayoutContainer hasReactions={Boolean(reactionsComp)}>
      <HStack style={contentContainerStyle}>
        {!fromMe && !isGroupUpdate && (
          <Fragment>
            {!hasNextMessageInSeries ? (
              <ConversationSenderAvatar />
            ) : (
              <VStack style={messageStyles.avatarPlaceholder} />
            )}
            <VStack style={messageStyles.avatarSpacer} />
          </Fragment>
        )}

        <VStack style={messageContainerStyle}>
          {!fromMe && !hasPreviousMessageInSeries && !isGroupUpdate && (
            <VStack style={senderNameContainerStyle}>
              <ConversationMessageSenderName />
            </VStack>
          )}

          {messageComp}
        </VStack>
      </HStack>

      {Boolean(reactionsComp) && <HStack style={reactionsContainerStyle}>{reactionsComp}</HStack>}

      {Boolean(messageStatusComp) && (
        <HStack style={messageStyles.messageStatus}>{messageStatusComp}</HStack>
      )}
    </ConversationMessageLayoutContainer>
  )
})

const ConversationMessageLayoutContainer = memo(function ConversationMessageLayoutContainer(args: {
  children: ReactNode
  hasReactions: boolean
}) {
  const { children, hasReactions } = args

  const messageStyles = useConversationMessageLayoutStyles()

  const hasNextMessageInSeries = useConversationMessageContextSelector(
    (s) => s.hasNextMessageInSeries,
  )
  const isLastMessage = useConversationMessageContextSelector((s) => s.isLastMessage)
  const fromMe = useConversationMessageContextSelector((s) => s.fromMe)
  const isGroupUpdate = useConversationMessageContextSelector((s) => s.isGroupUpdateMessage)
  const nextShouldShowDateChange = useConversationMessageContextSelector(
    (s) => s.nextShouldShowDateChange,
  )

  const containerStyle = useMemo(() => {
    const marginBottom = (() => {
      if (isLastMessage && !fromMe) {
        // Random value, we just wanted this for now since we don't want the last message to be too close to the reply message
        return messageStyles.spaceBetweenMessageFromDifferentUserOrType / 2
      }

      // Group updates already have vertical spacing
      if (isGroupUpdate) {
        return 0
      }

      // Since we show the send status for the last message for the current user, we don't need to add any spacing
      if (isLastMessage && fromMe) {
        return 0
      }

      // No spacing if we already show date change between current and next message because the timestamp already have spacing
      if (nextShouldShowDateChange) {
        return 0
      }

      // Spacing between messages from different users
      if (!hasNextMessageInSeries) {
        return messageStyles.spaceBetweenMessageFromDifferentUserOrType
      }

      // Spacing between messages with reactions
      if (hasReactions) {
        return messageStyles.spaceBetweenSeriesWithReactions
      }

      // Spacing between messages in a series
      return messageStyles.spaceBetweenMessagesInSeries
    })()

    return {
      marginBottom,
    } satisfies StyleProp<ViewStyle>
  }, [
    messageStyles,
    hasNextMessageInSeries,
    hasReactions,
    isLastMessage,
    fromMe,
    isGroupUpdate,
    nextShouldShowDateChange,
  ])

  return <VStack style={containerStyle}>{children}</VStack>
})

function useConversationMessageLayoutStyles() {
  const {
    messageContainerSidePadding,
    spaceBetweenSenderAvatarAndMessage,
    senderAvatarSize,
    spaceBetweenMessageFromDifferentUserOrType,
    spaceBetweenMessagesInSeries,
    spaceBetweenMessageAndSender,
    senderNameLeftMargin,
    spaceBetweenSeriesWithReactions,
  } = useConversationMessageStyles()

  return useMemo(() => {
    const hStackBase: StyleProp<ViewStyle> = {
      width: "100%",
      alignItems: "flex-end",
    }

    const hStackFromMe: StyleProp<ViewStyle> = {
      ...hStackBase,
      paddingRight: messageContainerSidePadding,
      justifyContent: "flex-end",
    }

    const hStackFromOther: StyleProp<ViewStyle> = {
      ...hStackBase,
      paddingLeft: messageContainerSidePadding,
      justifyContent: "flex-start",
    }

    const avatarPlaceholder: StyleProp<ViewStyle> = {
      width: senderAvatarSize,
    }

    const avatarSpacer: StyleProp<ViewStyle> = {
      width: spaceBetweenSenderAvatarAndMessage,
    }

    const messageContainer: StyleProp<ViewStyle> = {
      width: "100%",
      paddingVertical: 0.5, // Seems weird but for some reason otherwise the messages are too close to each other
    }

    const reactionsFromMe: StyleProp<ViewStyle> = {
      paddingRight: messageContainerSidePadding,
      justifyContent: "flex-end",
    }

    const reactionsFromOther: StyleProp<ViewStyle> = {
      paddingLeft:
        messageContainerSidePadding + spaceBetweenSenderAvatarAndMessage + senderAvatarSize,
      justifyContent: "flex-start",
    }

    const messageStatus: StyleProp<ViewStyle> = {
      paddingRight: messageContainerSidePadding,
      justifyContent: "flex-end",
    }

    return {
      hStackBase,
      hStackFromMe,
      hStackFromOther,
      avatarPlaceholder,
      avatarSpacer,
      messageContainer,
      reactionsFromMe,
      reactionsFromOther,
      messageStatus,
      spaceBetweenMessageFromDifferentUserOrType,
      spaceBetweenMessagesInSeries,
      spaceBetweenSeriesWithReactions,
      senderNameLeftMargin,
      spaceBetweenMessageAndSender,
      senderAvatarSize,
      spaceBetweenSenderAvatarAndMessage,
      messageContainerSidePadding,
    }
  }, [
    messageContainerSidePadding,
    spaceBetweenSenderAvatarAndMessage,
    senderAvatarSize,
    spaceBetweenMessageFromDifferentUserOrType,
    spaceBetweenMessagesInSeries,
    spaceBetweenMessageAndSender,
    senderNameLeftMargin,
    spaceBetweenSeriesWithReactions,
  ])
}
