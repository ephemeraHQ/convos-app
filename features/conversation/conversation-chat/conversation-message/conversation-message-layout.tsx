import { useInfiniteQuery } from "@tanstack/react-query"
import { Fragment, memo, ReactNode, useEffect, useMemo } from "react"
import { StyleProp, ViewStyle } from "react-native"
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { HStack } from "@/design-system/HStack"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationMessageSender } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-sender"
import { ConversationSenderAvatar } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-sender-avatar"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessageStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.styles"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { getConversationMessagesInfiniteQueryOptions } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useHasNextMessageInSeries } from "@/features/conversation/utils/has-next-message-in-serie"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationMessageLayout = memo(function ConversationMessageLayout(args: {
  reactions?: ReactNode
  message?: ReactNode
  messageStatus?: ReactNode
}) {
  const { reactions, message, messageStatus } = args
  const messageStyles = useConversationMessageLayoutStyles()

  const fromMe = useConversationMessageContextSelector((s) => s.fromMe)
  const senderInboxId = useConversationMessageContextSelector((s) => s.senderInboxId)
  const hasPreviousMessageInSeries = useConversationMessageContextSelector(
    (s) => s.hasPreviousMessageInSeries,
  )
  const isSystemMessage = useConversationMessageContextSelector((s) => s.isSystemMessage)
  const messageData = useConversationMessageContextSelector((s) => s.message)

  const { data: hasNextMessageInSeries } = useHasNextMessageInSeries({
    currentMessageId: messageData.xmtpId,
    xmtpConversationId: messageData.xmtpConversationId,
  })

  const isGroupUpdate = isGroupUpdatedMessage(messageData)

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
        ...(Boolean(reactions) && {
          marginBottom: messageStyles.spaceBetweenMessagesInSeries,
        }),
      },
    ] as StyleProp<ViewStyle>
  }, [fromMe, reactions, messageStyles])

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
    <ConversationMessageLayoutContainer hasReactions={Boolean(reactions)}>
      <HStack style={contentContainerStyle}>
        {!fromMe && !isSystemMessage && (
          <Fragment>
            {!hasNextMessageInSeries ? (
              <ConversationSenderAvatar inboxId={senderInboxId} />
            ) : (
              <VStack style={messageStyles.avatarPlaceholder} />
            )}
            <VStack style={messageStyles.avatarSpacer} />
          </Fragment>
        )}

        <VStack style={messageContainerStyle}>
          {!fromMe && !hasPreviousMessageInSeries && !isSystemMessage && (
            <VStack style={senderNameContainerStyle}>
              <ConversationMessageSender inboxId={senderInboxId} />
            </VStack>
          )}

          {message}
        </VStack>
      </HStack>

      {Boolean(reactions) && <HStack style={reactionsContainerStyle}>{reactions}</HStack>}

      {Boolean(messageStatus) && (
        <HStack style={messageStyles.messageStatus}>{messageStatus}</HStack>
      )}
    </ConversationMessageLayoutContainer>
  )
})

function useIsLastMessage(args: {
  xmtpMessageId: IXmtpMessageId | undefined
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpMessageId, xmtpConversationId } = args

  const currentSender = useSafeCurrentSender()

  return useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "isLastMessage",
    }),
    select: (data) => {
      const allMessageIds = data?.pages.flatMap((page) => page.messageIds) || []
      const currentIndex = allMessageIds.findIndex((id) => id === xmtpMessageId)
      return currentIndex === allMessageIds.length - 1
    },
  })
}

const ConversationMessageLayoutContainer = memo(function ConversationMessageLayoutContainer(args: {
  children: ReactNode
  hasReactions: boolean
}) {
  const { children, hasReactions } = args

  const { theme } = useAppTheme()

  const messageStyles = useConversationMessageLayoutStyles()

  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const xmtpMessageId = useConversationMessageContextSelector((s) => s.xmtpMessageId)

  const { data: hasNextMessageInSeries } = useHasNextMessageInSeries({
    currentMessageId: xmtpMessageId,
    xmtpConversationId,
  })

  const { data: isLastMessage } = useIsLastMessage({
    xmtpMessageId,
    xmtpConversationId,
  })

  const containerMarginBottom = useMemo(() => {
    if (isLastMessage) {
      return messageStyles.spaceBetweenMessageFromDifferentUserOrType
    }

    if (!hasNextMessageInSeries) {
      return 0
    }

    if (hasReactions) {
      return messageStyles.spaceBetweenSeriesWithReactions
    }

    return messageStyles.spaceBetweenMessagesInSeries
  }, [messageStyles, hasNextMessageInSeries, hasReactions, isLastMessage])

  const containerMarginBottomAV = useSharedValue(containerMarginBottom)

  useEffect(() => {
    containerMarginBottomAV.value = withSpring(containerMarginBottom, {
      stiffness: theme.animation.spring.stiffness,
      damping: theme.animation.spring.damping,
    })
  }, [containerMarginBottom, containerMarginBottomAV, theme])

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      marginBottom: containerMarginBottomAV.value,
    }
  })

  return (
    <AnimatedVStack
      // {...debugBorder()}
      layout={theme.animation.reanimatedLayoutSpringTransition}
      style={containerAnimatedStyle}
    >
      {children}
    </AnimatedVStack>
  )
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
