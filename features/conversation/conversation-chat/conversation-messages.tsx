import { FlashList, FlashListProps } from "@shopify/flash-list"
import React, { memo, ReactNode, useCallback, useMemo, useRef } from "react"
import { Platform } from "react-native"
import Animated, {
  AnimatedRef,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { useHeaderHeight } from "@/design-system/Header/Header.utils"
import { textSizeStyles } from "@/design-system/Text/Text.styles"
import { AnimatedVStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationConsentPopupDm } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-dm"
import { ConversationConsentPopupGroup } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-group"
import { ConversationInfoBanner } from "@/features/conversation/conversation-chat/conversation-info-banner"
import { ConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message"
import { ConversationMessageHighlighted } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-highlighted"
import { ConversationMessageLayout } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-layout"
import { ConversationMessageReactions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions/conversation-message-reactions"
import { ConversationMessageRepliable } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-repliable"
import { ConversationMessageStatus } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-status/conversation-message-status"
import { ConversationMessageTimestamp } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-timestamp"
import {
  getConversationMessageQueryData,
  useConversationMessageQuery,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { ConversationMessageContextStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import {
  IConversationMessage,
  IConversationMessageContentType,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { useMessageHasReactions } from "@/features/conversation/conversation-chat/conversation-message/hooks/use-message-has-reactions"
import {
  isAnActualMessage,
  isAttachmentsMessage,
  isGroupUpdatedMessage,
  messageContentIsGroupUpdated,
  messageContentIsText,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  checkForNewMessages,
  checkForNewMessagesAndReactions,
  DEFAULT_CONVERSATION_MESSAGES_PAGE_SIZE,
  invalidateConversationMessagesQuery,
  loadOlderMessages,
  useConversationMessagesQuery,
} from "@/features/conversation/conversation-chat/conversation-messages-simple.query"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { useMarkConversationAsReadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { listenForDisappearingMessageSettingsQueryChanges } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { refetchGroupQuery } from "@/features/groups/queries/group.query"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useEffectAfterInteractions } from "@/hooks/use-effect-after-interactions"
import { useAppStateHandler } from "@/stores/app-state-store/app-state-store.service"
import { window } from "@/theme/layout"
import { spacing } from "@/theme/spacing"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { logger } from "@/utils/logger/logger"
import {
  useConversationStore,
  useCurrentXmtpConversationIdSafe,
} from "./conversation.store-context"

// AI fixed the typing
const ReanimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<IXmtpMessageId>>,
) as <T>(props: FlashListProps<T> & { ref?: React.Ref<FlashList<T>> }) => JSX.Element

// Define some estimated heights for different message types.
// You should adjust these values based on your actual UI.
const ATTACHMENT_MESSAGE_HEIGHT = (window.height * 2) / 3 // Attachment are usually 2/3 of the screen height from what I've seen
const GROUP_UPDATE_MESSAGE_HEIGHT = textSizeStyles["md"].lineHeight
const GROUP_UPDATE_VERTICAL_PADDING = spacing.lg
const TEXT_MESSAGE_HEIGHT = spacing.xxs * 2 + textSizeStyles["md"].lineHeight
const DEFAULT_ESTIMATED_ITEM_SIZE = 100
const EXTRA_SPACE_BETWEEN_MESSAGE = spacing.sm // Extra random space to account for extra spacing for when message is from not the same user, or for the sender name space, or etc

export const ConversationMessages = memo(function ConversationMessages() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const scrollRef = useAnimatedRef<FlashList<IXmtpMessageId>>()
  const { theme } = useAppTheme()
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()

  const { data: messagesData } = useConversationMessagesQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  const messageIds = useMemo(() => messagesData?.messageIds || [], [messagesData?.messageIds])
  const hasMoreOlder = messagesData?.hasMoreOlder || false

  // Simple functions for the new approach
  const fetchNextPage = useCallback(async () => {
    return loadOlderMessages({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages fetchNextPage",
    })
  }, [currentSender.inboxId, xmtpConversationId])

  const hasNextPage = hasMoreOlder

  useRefetchOnAppFocus()
  useRefetchOnMount()
  useScrollToHighlightedMessage({ messageIds, listRef: scrollRef })
  useMarkAsRead({ messageIds })
  useHandleDisappearingMessagesSettings()
  const { scrollHandler } = useHandleSrolling({ fetchNextPage, hasNextPage })

  const renderItem = useCallback(
    ({ item, index }: { item: IXmtpMessageId; index: number }) => {
      const previousXmtpMessageId = messageIds[index + 1]
      const nextXmtpMessageId = messageIds[index - 1]

      return (
        <ConversationMessagesListItem
          xmtpMessageId={item}
          isNewestMessage={index === 0}
          previousXmtpMessageId={previousXmtpMessageId}
          nextXmtpMessageId={nextXmtpMessageId}
        />
      )
    },
    [messageIds],
  )

  const getItemType = useCallback(
    (item: IXmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId: item,
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      let type: IConversationMessageContentType

      if (!message) {
        type = "text"
      } else if (isAttachmentsMessage(message)) {
        type = "remoteAttachment"
      } else if (isGroupUpdatedMessage(message)) {
        type = "groupUpdated"
      } else {
        type = "text"
      }

      return type
    },
    [currentSender.inboxId, xmtpConversationId],
  )

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: IXmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId: item,
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      if (!message) {
        layout.size = DEFAULT_ESTIMATED_ITEM_SIZE + EXTRA_SPACE_BETWEEN_MESSAGE
        return
      }

      // group updates
      if (messageContentIsGroupUpdated(message.content)) {
        const numberOfUpdates =
          message.content.membersAdded.length +
          message.content.membersRemoved.length +
          (message.content.metadataFieldsChanged ? 1 : 0)
        layout.size =
          GROUP_UPDATE_MESSAGE_HEIGHT * numberOfUpdates +
          GROUP_UPDATE_VERTICAL_PADDING +
          EXTRA_SPACE_BETWEEN_MESSAGE
        return
      }

      // attachments
      if (isAttachmentsMessage(message)) {
        layout.size = ATTACHMENT_MESSAGE_HEIGHT + EXTRA_SPACE_BETWEEN_MESSAGE
        return
      }

      if (messageContentIsText(message.content)) {
        const numberOfChunks = Math.ceil(message.content.text.length / 20)
        layout.size = TEXT_MESSAGE_HEIGHT * numberOfChunks + EXTRA_SPACE_BETWEEN_MESSAGE
        return
      }

      // Unknown message type
      layout.size = DEFAULT_ESTIMATED_ITEM_SIZE + EXTRA_SPACE_BETWEEN_MESSAGE
    },
    [currentSender.inboxId, xmtpConversationId],
  )

  const estimatedListSize = useMemo(() => {
    return {
      height:
        theme.layout.screen.height -
        headerHeight -
        insets.bottom +
        // Composer height
        theme.spacing.xl,
      width: theme.layout.screen.width,
    }
  }, [
    headerHeight,
    insets.bottom,
    theme.layout.screen.height,
    theme.layout.screen.width,
    theme.spacing.xl,
  ])

  logger.debug(`Rendering ${messageIds.length} messages`)

  return (
    <ReanimatedFlashList
      ref={scrollRef}
      data={messageIds}
      renderItem={renderItem}
      estimatedItemSize={DEFAULT_ESTIMATED_ITEM_SIZE}
      overrideItemLayout={overrideItemLayout}
      inverted
      initialScrollIndex={0}
      keyExtractor={keyExtractor}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={Platform.OS === "ios"} // Size glitch on Android
      onScroll={scrollHandler}
      scrollEventThrottle={100} // We don't need to be that accurate
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ConsentPopup}
      ListFooterComponent={ListFooterComponent}
      getItemType={getItemType}
      estimatedListSize={estimatedListSize}

      // LEGEND LIST PROPS
      // initialScrollIndex={messageIdsReversed.length - 1}
      // style={$globalStyles.flex1}
      // recycleItems={true}
      // maintainScrollAtEnd
      // maintainScrollAtEndThreshold={1}
      // alignItemsAtEnd
      // maintainVisibleContentPosition
      // getEstimatedItemSize={} // Maybe try this to fix overlapping attachments messages
      // waitForInitialLayout={false}
    />
  )
})

function useRefetchOnAppFocus() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useAppStateHandler({
    onForeground: () => {
      logger.debug(
        "Conversation Messages came to foreground, checking for new messages and reactions...",
      )
      checkForNewMessagesAndReactions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: "Conversation Messages useRefetchOnAppFocus",
      })
        .then(() => {
          logger.debug("Done checking for new messages and reactions because we came to foreground")
        })
        .catch(captureError)
    },
  })
}

function useRefetchOnMount() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useEffectAfterInteractions(() => {
    logger.debug("Conversation Messages mounted, refetching messages...")
    checkForNewMessages({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages useRefetchOnMount",
    })
      .then(() => {
        logger.debug("Done refetching messages because we mounted")
      })
      .catch(captureError)
  }, [currentSender.inboxId, xmtpConversationId])
}

function useHandleDisappearingMessagesSettings() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useEffectAfterInteractions(() => {
    let interval: NodeJS.Timeout | undefined

    const { unsubscribe } = listenForDisappearingMessageSettingsQueryChanges({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "useHandleDisappearingMessagesSettings",
      onChanges: (result) => {
        if (result.data?.retentionDurationInNs) {
          if (interval) {
            clearInterval(interval)
          }
          interval = setInterval(() => {
            invalidateConversationMessagesQuery({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId,
            })
          }, convertNanosecondsToMilliseconds(result.data.retentionDurationInNs))
        } else {
          if (interval) {
            clearInterval(interval)
          }
        }
      },
    })

    return () => {
      unsubscribe()
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentSender.inboxId, xmtpConversationId])
}

function useMarkAsRead(props: { messageIds: IXmtpMessageId[] }) {
  const { messageIds } = props
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const { mutateAsync: markAsReadAsync } = useMarkConversationAsReadMutation({
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  useEffectAfterInteractions(() => {
    if (messageIds.length === 0) {
      return
    }
    markAsReadAsync().catch(captureError)
  }, [messageIds.length, markAsReadAsync, xmtpConversationId])
}

function useScrollToHighlightedMessage(props: {
  messageIds: IXmtpMessageId[]
  listRef: AnimatedRef<FlashList<IXmtpMessageId>>
}) {
  const { messageIds, listRef } = props
  const conversationStore = useConversationStore()

  // Scroll to message when we select one in the store
  useEffectAfterInteractions(() => {
    const unsubscribe = conversationStore.subscribe(
      (state) => state.scrollToXmtpMessageId,
      (scrollToXmtpMessageId) => {
        if (!scrollToXmtpMessageId) {
          return
        }

        const index = messageIds.findIndex((messageId) => messageId === scrollToXmtpMessageId)

        if (index === -1) {
          return
        }

        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewOffset: 100, // Random value just so that the message is not directly at the bottom
        })

        conversationStore.setState({
          scrollToXmtpMessageId: undefined,
        })
      },
    )

    return () => {
      unsubscribe()
    }
  }, [conversationStore, listRef, messageIds])
}

function useHandleSrolling(props: { fetchNextPage: () => Promise<void>; hasNextPage: boolean }) {
  const { fetchNextPage, hasNextPage } = props
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const isRefreshingRef = useRef(false)
  const isFetchingMoreMessagesRef = useRef(false)

  const handleRefetchBecauseScrolledBottom = useCallback(() => {
    if (isRefreshingRef.current) {
      return
    }

    isRefreshingRef.current = true

    logger.debug(
      "Checking for new messages and reactions because we're scrolled past the bottom...",
    )
    checkForNewMessagesAndReactions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages handleRefetchBecauseScrolledBottom",
    })
      .then(() => {
        logger.debug(
          "Done checking for new messages and reactions because we're scrolled past the bottom",
        )
      })
      .catch(captureError)
      .finally(() => {
        isRefreshingRef.current = false
      })

    // Also refetch group query so the header updates if it needs to
    refetchGroupQuery({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages",
    }).catch(captureError)
  }, [currentSender.inboxId, xmtpConversationId])

  const handleFetchNext = useCallback(() => {
    if (isFetchingMoreMessagesRef.current) {
      return
    }

    isFetchingMoreMessagesRef.current = true

    logger.debug("Fetching older messages because we're scrolled past the top...")
    fetchNextPage()
      .then(() => {
        logger.debug("Done fetching older messages because we're scrolled past the top")
      })
      .catch(captureError)
      .finally(() => {
        isFetchingMoreMessagesRef.current = false
      })
  }, [fetchNextPage])

  const scrollHandler = useAnimatedScrollHandler(
    (event) => {
      "worklet"

      // contentOffset: Current scroll position (y is positive when scrolling up in inverted list)
      // contentSize: Total size of all content in the list
      // layoutMeasurement: Size of the visible viewport
      const { contentOffset, contentSize, layoutMeasurement } = event

      // Calculate distance from top of older messages
      // In inverted lists, we're at "top" of old messages when contentOffset.y is large
      const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y

      // Trigger loading when within 1 list height from the top
      const isPastTopThreshold = distanceFromTop < layoutMeasurement.height

      if (isPastTopThreshold && hasNextPage) {
        runOnJS(handleFetchNext)()
      }

      // For inverted list, we need to check if we're scrolled past the bottom to refetch latest messages
      const isPastBottomThreshold = contentOffset.y < -50

      if (isPastBottomThreshold) {
        runOnJS(handleRefetchBecauseScrolledBottom)()
      }
    },
    [hasNextPage, handleFetchNext, handleRefetchBecauseScrolledBottom],
  )

  return {
    scrollHandler,
  }
}

const ListFooterComponent = memo(function ListFooterComponent() {
  const { theme } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { data: { messageIds = [], hasMoreOlder = false } = {}, isLoading: isLoadingMessageIds } =
    useConversationMessagesQuery({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages ListFooterComponent",
    })

  const { data: conversationType } = useConversationType({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationMessages ListFooterComponent",
  })

  const isGroup = conversationType === "group"

  // Want to ignore hasNextPage if we have less than DEFAULT_PAGE_SIZE messages
  // because for some reason sometimes hasNextPage was true even tho we didn't have more.
  // It's just since we haven't triggering fetching more once.
  const hasLessThanOnePageOfMessages = messageIds.length < DEFAULT_CONVERSATION_MESSAGES_PAGE_SIZE
  const hasNoMoreMessages = !hasMoreOlder
  const isNotLoading = !isLoadingMessageIds

  if ((hasLessThanOnePageOfMessages || hasNoMoreMessages) && isGroup && isNotLoading) {
    return (
      <IsReadyWrapper>
        <AnimatedVStack entering={theme.animation.reanimatedFadeInUpSpring}>
          <ConversationInfoBanner />
        </AnimatedVStack>
      </IsReadyWrapper>
    )
  }

  return null
})

const ConversationMessagesListItem = memo(function ConversationMessagesListItem(props: {
  xmtpMessageId: IXmtpMessageId
  previousXmtpMessageId: IXmtpMessageId | undefined
  nextXmtpMessageId: IXmtpMessageId | undefined
  isNewestMessage: boolean
}) {
  const { xmtpMessageId, previousXmtpMessageId, nextXmtpMessageId, isNewestMessage } = props

  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const { data: message } = useConversationMessageQuery({
    xmtpMessageId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessagesListItem",
    xmtpConversationId,
  })

  const isFromCurrentSender = message?.senderInboxId === currentSender.inboxId

  const messageComponent = useMemo(
    () => (
      <ConversationMessageHighlighted>
        <ConversationMessage />
      </ConversationMessageHighlighted>
    ),
    [],
  )

  const statusComponent = useMemo(
    () =>
      isFromCurrentSender && message && isAnActualMessage(message) && isNewestMessage ? (
        <ConversationMessageStatus />
      ) : null,
    [isFromCurrentSender, message, isNewestMessage],
  )

  const { data: messageHasReactions } = useMessageHasReactions({
    xmtpMessageId,
  })

  const reactionsComponent = useMemo(
    () => (messageHasReactions ? <ConversationMessageReactions /> : null),
    [messageHasReactions],
  )

  const { data: previousMessage } = useConversationMessageQuery({
    xmtpMessageId: previousXmtpMessageId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessagesListItem",
    xmtpConversationId,
  })

  const { data: nextMessage } = useConversationMessageQuery({
    xmtpMessageId: nextXmtpMessageId,
    clientInboxId: currentSender.inboxId,
    caller: "ConversationMessagesListItem",
    xmtpConversationId,
  })

  if (!message) {
    return null
  }

  return (
    <ConversationMessageContextStoreProvider
      currentMessage={message}
      previousMessage={previousMessage ?? undefined}
      nextMessage={nextMessage ?? undefined}
    >
      <ConversationNewMessageAnimationWrapper
        animateEntering={
          isNewestMessage &&
          message.senderInboxId === currentSender.inboxId &&
          messageWasJustSent(message)
        }
      >
        <ConversationMessageTimestamp />
        <ConversationMessageRepliableWrapper messageType={message.type}>
          <ConversationMessageLayout
            messageComp={messageComponent}
            reactionsComp={reactionsComponent}
            messageStatusComp={statusComponent}
          />
        </ConversationMessageRepliableWrapper>
      </ConversationNewMessageAnimationWrapper>
    </ConversationMessageContextStoreProvider>
  )
})

const ConversationMessageRepliableWrapper = memo(
  function ConversationMessageRepliableWrapper(props: {
    children: ReactNode
    messageType: IConversationMessageContentType
  }) {
    const { children, messageType } = props

    if (messageType === "groupUpdated") {
      return children
    }

    return <ConversationMessageRepliable>{children}</ConversationMessageRepliable>
  },
)

function messageWasJustSent(message: IConversationMessage) {
  return message.sentMs > Date.now() - 1000
}

// This function generates the custom entering animation configuration.
// It's called on the JS thread, and returns a worklet that Reanimated executes on the UI thread.
// function createCustomMessageEnteringAnimation(isIncoming: boolean) {
//   // The returned function is the actual worklet.
//   return (targetValues: {
//     targetOriginX: number
//     targetOriginY: number
//     targetWidth: number
//     targetHeight: number
//   }) => {
//     "worklet"
//     const rotationInRad = isIncoming ? -60 : 60 // Increased rotation
//     const initialXOffset = isIncoming ? -60 : 60 // Increased X offset
//     const initialYOffset = 100 // Increased Y offset for more dramatic bottom entry

//     const initialValues = {
//       opacity: 0,
//       originX: targetValues.targetOriginX + initialXOffset,
//       originY: targetValues.targetOriginY + initialYOffset,
//       width: targetValues.targetWidth,
//       height: targetValues.targetHeight,
//       transform: [
//         { rotate: `${rotationInRad}deg` },
//         // { scale: 0.8 }
//       ],
//     }

//     const animations = {
//       opacity: withSpring(1, {
//         damping: SICK_DAMPING,
//         stiffness: SICK_STIFFNESS,
//       }),
//       originX: withSpring(targetValues.targetOriginX, {
//         damping: SICK_DAMPING,
//         stiffness: SICK_STIFFNESS,
//       }),
//       originY: withSpring(targetValues.targetOriginY, {
//         damping: SICK_DAMPING,
//         stiffness: SICK_STIFFNESS,
//       }),
//       transform: [
//         // {
//         //   scale: withSpring(1, {
//         //     damping: SICK_DAMPING,
//         //     stiffness: SICK_STIFFNESS,
//         //   }),
//         // },
//         {
//           rotate: withSpring("0deg", {
//             damping: SICK_DAMPING,
//             stiffness: SICK_STIFFNESS,
//           }),
//         },
//       ],
//     }
//     return {
//       initialValues,
//       animations,
//     }
//   }
// }

const ConversationNewMessageAnimationWrapper = memo(
  function ConversationNewMessageAnimationWrapper(props: {
    animateEntering: boolean
    children: ReactNode
  }) {
    const { children, animateEntering } = props
    const { theme } = useAppTheme()

    if (!animateEntering) {
      return children
    }

    return (
      <AnimatedVStack entering={theme.animation.reanimatedFadeInDownSpring}>
        {children}
      </AnimatedVStack>
    )
  },
)

const ListEmptyComponent = memo(function ListEmptyComponent() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  if (!conversation) {
    return null
  }

  return isConversationDm(conversation) ? <DmConversationEmpty /> : <GroupConversationEmpty />
})

const ConsentPopup = memo(function ConsentPopup() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  if (!conversation) {
    return null
  }

  if (isConversationAllowed(conversation)) {
    return null
  }

  if (isConversationDm(conversation)) {
    return <ConversationConsentPopupDm />
  }

  return <ConversationConsentPopupGroup />
})

const DmConversationEmpty = memo(function DmConversationEmpty() {
  // Will never really be empty anyway because to create the DM conversation the user has to send a first message
  return null
})

const GroupConversationEmpty = memo(() => {
  // Will never really be empty anyway becaue we have group updates
  return null
})

const keyExtractor = (messageId: IXmtpMessageId) => {
  return messageId
}
