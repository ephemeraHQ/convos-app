import { FlashList, FlashListProps } from "@shopify/flash-list"
import { InfiniteQueryObserverResult } from "@tanstack/react-query"
import React, { memo, ReactNode, useCallback, useEffect, useMemo, useRef } from "react"
import { Platform } from "react-native"
import Animated, {
  AnimatedRef,
  FadeInDown,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from "react-native-reanimated"
import { ConditionalWrapper } from "@/components/conditional-wrapper"
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
import { useMessageHasReactions } from "@/features/conversation/conversation-chat/conversation-message/hooks/use-message-has-reactions"
import {
  isAnActualMessage,
  isAttachmentsMessage,
  isGroupUpdatedMessage,
  messageContentIsGroupUpdated,
  messageContentIsText,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import {
  DEFAULT_PAGE_SIZE,
  refetchConversationMessagesInfiniteQuery,
  useConversationMessagesInfiniteQueryAllMessageIds,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { useMarkConversationAsReadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { listenForDisappearingMessageSettingsQueryChanges } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { refetchGroupQuery } from "@/features/groups/queries/group.query"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useEffectOnce } from "@/hooks/use-effect-once"
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
const TEXT_MESSAGE_HEIGHT = 80
const DEFAULT_ESTIMATED_ITEM_SIZE = 100

type IMessageType = "attachment" | "groupUpdate" | "message"

export const ConversationMessages = memo(function ConversationMessages() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const scrollRef = useAnimatedRef<FlashList<IXmtpMessageId>>()
  const { theme } = useAppTheme()

  const {
    data: messageIds = [],
    fetchNextPage,
    hasNextPage,
  } = useConversationMessagesInfiniteQueryAllMessageIds({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  useRefetchOnAppFocus()
  useRefetchOnMount()
  useScrollToHighlightedMessage({ messageIds, listRef: scrollRef })
  useMarkAsReadOnMount({ messageIds })
  useHandleDisappearingMessagesSettings()
  const { scrollHandler } = useHandleSrolling({ fetchNextPage, hasNextPage })

  const latestXmtpMessageIdFromCurrentSender = useMemo(() => {
    return messageIds.find((xmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId,
        xmtpConversationId,
        clientInboxId: currentSender.inboxId,
      })
      return message?.senderInboxId === currentSender.inboxId
    })
  }, [messageIds, currentSender.inboxId, xmtpConversationId])

  const renderItem = useCallback(
    ({ item, index }: { item: IXmtpMessageId; index: number }) => {
      const previousXmtpMessageId = messageIds[index + 1]
      const nextXmtpMessageId = messageIds[index - 1]

      return (
        <ConversationMessagesListItem
          xmtpMessageId={item}
          isLatestXmtpMessageIdFromCurrentSender={latestXmtpMessageIdFromCurrentSender === item}
          previousXmtpMessageId={previousXmtpMessageId}
          nextXmtpMessageId={nextXmtpMessageId}
          animateEntering={
            index === 0 &&
            getConversationMessageQueryData({
              xmtpMessageId: item,
              clientInboxId: currentSender.inboxId,
              xmtpConversationId,
            })?.status === "sending"
          }
        />
      )
    },
    [currentSender.inboxId, latestXmtpMessageIdFromCurrentSender, messageIds, xmtpConversationId],
  )

  const getItemType = useCallback(
    (item: IXmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId: item,
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      let type: IMessageType

      if (!message) {
        type = "message"
      } else if (isAttachmentsMessage(message)) {
        type = "attachment"
      } else if (isGroupUpdatedMessage(message)) {
        type = "groupUpdate"
      } else {
        type = "message"
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
        layout.size = DEFAULT_ESTIMATED_ITEM_SIZE
        return
      }

      // group updates
      if (messageContentIsGroupUpdated(message.content)) {
        const numberOfUpdates =
          message.content.membersAdded.length +
          message.content.membersRemoved.length +
          (message.content.metadataFieldsChanged ? 1 : 0)
        layout.size = GROUP_UPDATE_MESSAGE_HEIGHT * numberOfUpdates + GROUP_UPDATE_VERTICAL_PADDING
        return
      }

      // attachments
      if (isAttachmentsMessage(message)) {
        layout.size = ATTACHMENT_MESSAGE_HEIGHT
        return
      }

      if (messageContentIsText(message.content)) {
        const numberOfChunks = Math.ceil(message.content.text.length / 20)
        layout.size = TEXT_MESSAGE_HEIGHT * numberOfChunks
        return
      }

      // Unknown message type
      layout.size = DEFAULT_ESTIMATED_ITEM_SIZE
    },
    [currentSender.inboxId, xmtpConversationId],
  )

  logger.debug(`Rendering ${messageIds.length} messages`)

  return (
    <ReanimatedFlashList
      ref={scrollRef}
      data={messageIds}
      renderItem={renderItem}
      drawDistance={window.height / 2}
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
      ListFooterComponent={<ListFooterComponent />}
      getItemType={getItemType}
      estimatedListSize={{
        height: theme.layout.screen.height,
        width: theme.layout.screen.width,
      }}

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
      logger.debug("Conversation Messages came to foreground, refetching messages...")
      refetchConversationMessagesInfiniteQuery({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
        caller: "Conversation Messages refetch on foreground",
      })
        .then(() => {
          logger.debug("Done refetching messages because we came to foreground")
        })
        .catch(captureError)
    },
  })
}

function useRefetchOnMount() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useEffectOnce(() => {
    logger.debug("Conversation Messages mounted, refetching messages...")
    refetchConversationMessagesInfiniteQuery({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages refetch on mount",
    })
      .then(() => {
        logger.debug("Done refetching messages because we mounted")
      })
      .catch(captureError)
  })
}

function useHandleDisappearingMessagesSettings() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined

    const { unsubscribe } = listenForDisappearingMessageSettingsQueryChanges({
      clientInboxId: currentSender.inboxId,
      conversationId: xmtpConversationId,
      caller: "useHandleDisappearingMessagesSettings",
      onChanges: (result) => {
        if (result.data?.retentionDurationInNs) {
          if (interval) {
            clearInterval(interval)
          }
          interval = setInterval(() => {
            refetchConversationMessagesInfiniteQuery({
              clientInboxId: currentSender.inboxId,
              xmtpConversationId,
              caller: "useHandleDisappearingMessagesSettings refetch on retention duration change",
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

function useMarkAsReadOnMount(props: { messageIds: IXmtpMessageId[] }) {
  const { messageIds } = props
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const { mutateAsync: markAsReadAsync } = useMarkConversationAsReadMutation({
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  // Safer to just mark as read every time messages change
  useEffect(() => {
    if (isTmpConversation(xmtpConversationId)) {
      return
    }
    if (messageIds.length === 0) {
      return
    }
    markAsReadAsync().catch(captureError)
  }, [markAsReadAsync, xmtpConversationId, messageIds.length])
}

function useScrollToHighlightedMessage(props: {
  messageIds: IXmtpMessageId[]
  listRef: AnimatedRef<FlashList<IXmtpMessageId>>
}) {
  const { messageIds, listRef } = props
  const conversationStore = useConversationStore()

  // Scroll to message when we select one in the store
  useEffect(() => {
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

function useHandleSrolling(props: {
  fetchNextPage: () => Promise<InfiniteQueryObserverResult<IXmtpMessageId[], Error>>
  hasNextPage: boolean
}) {
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

    logger.debug("Refetching newest messages because we're scrolled past the bottom...")
    refetchConversationMessagesInfiniteQuery({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages refetch on scroll past bottom",
    })
      .then(() => {
        logger.debug("Done refetching newest messages because we're scrolled past the bottom")
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

  const scrollHandler = useAnimatedScrollHandler((event) => {
    "worklet"

    // contentOffset: Current scroll position (y is positive when scrolling up in inverted list)
    // contentSize: Total size of all content in the list
    // layoutMeasurement: Size of the visible viewport
    const { contentOffset, contentSize, layoutMeasurement } = event

    // Calculate distance from top of older messages
    // In inverted lists, we're at "top" of old messages when contentOffset.y is large
    const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y

    // Trigger loading when within 20% of viewport height from the top
    const isPastTopThreshold = distanceFromTop < layoutMeasurement.height * 0.2

    if (isPastTopThreshold && hasNextPage) {
      runOnJS(handleFetchNext)()
    }

    // For inverted list, we need to check if we're scrolled past the bottom to refetch latest messages
    const isPastBottomThreshold = contentOffset.y < -25

    if (isPastBottomThreshold) {
      runOnJS(handleRefetch)()
    }
  })

  return {
    scrollHandler,
  }
}

const ListFooterComponent = memo(function ListFooterComponent() {
  const { theme } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const {
    data: messageIds = [],
    hasNextPage,
    isLoading: isLoadingMessageIds,
  } = useConversationMessagesInfiniteQueryAllMessageIds({
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
  const hasLessThanOnePageOfMessages = messageIds.length < DEFAULT_PAGE_SIZE
  const hasNoMoreMessages = !hasNextPage
  const isNotLoading = !isLoadingMessageIds

  if ((hasLessThanOnePageOfMessages || hasNoMoreMessages) && isGroup && isNotLoading) {
    return (
      <AnimatedVStack entering={theme.animation.reanimatedFadeInSpring}>
        <ConversationInfoBanner />
      </AnimatedVStack>
    )
  }

  return null
})

const ConversationMessagesListItem = memo(
  function ConversationMessagesListItem(props: {
    xmtpMessageId: IXmtpMessageId
    previousXmtpMessageId: IXmtpMessageId | undefined
    nextXmtpMessageId: IXmtpMessageId | undefined
    animateEntering: boolean
    isLatestXmtpMessageIdFromCurrentSender: boolean
  }) {
    const {
      xmtpMessageId,
      previousXmtpMessageId,
      nextXmtpMessageId,
      animateEntering,
      isLatestXmtpMessageIdFromCurrentSender,
    } = props

    const currentSender = useSafeCurrentSender()
    const xmtpConversationId = useCurrentXmtpConversationIdSafe()
    const { data: message } = useConversationMessageQuery({
      xmtpMessageId,
      clientInboxId: currentSender.inboxId,
      caller: "ConversationMessagesListItem",
      xmtpConversationId,
    })

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
        isLatestXmtpMessageIdFromCurrentSender && message && isAnActualMessage(message) ? (
          <ConversationMessageStatus />
        ) : null,
      [isLatestXmtpMessageIdFromCurrentSender, message],
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
        <ConversationNewMessageAnimationWrapper animateEntering={animateEntering}>
          <ConversationMessageTimestamp />
          <ConditionalWrapper
            condition={message.type !== "groupUpdated"}
            wrapper={(children) => (
              <ConversationMessageRepliable>{children}</ConversationMessageRepliable>
            )}
          >
            <ConversationMessageLayout
              messageComp={messageComponent}
              reactionsComp={reactionsComponent}
              messageStatusComp={statusComponent}
            />
          </ConditionalWrapper>
        </ConversationNewMessageAnimationWrapper>
      </ConversationMessageContextStoreProvider>
    )
  },
  (prevProps, nextProps) => {
    const isSameMessageId = prevProps.xmtpMessageId === nextProps.xmtpMessageId
    const isSamePreviousXmtpMessageId =
      prevProps.previousXmtpMessageId === nextProps.previousXmtpMessageId
    const isSameNextXmtpMessageId = prevProps.nextXmtpMessageId === nextProps.nextXmtpMessageId
    const isSameLatestXmtpMessageIdFromCurrentSender =
      prevProps.isLatestXmtpMessageIdFromCurrentSender ===
      nextProps.isLatestXmtpMessageIdFromCurrentSender

    return (
      isSameMessageId &&
      isSamePreviousXmtpMessageId &&
      isSameNextXmtpMessageId &&
      isSameLatestXmtpMessageIdFromCurrentSender
    )
  },
)

const ConversationNewMessageAnimationWrapper = memo(
  function ConversationNewMessageAnimationWrapper(props: {
    animateEntering: boolean
    children: ReactNode
  }) {
    const { animateEntering, children } = props
    const { theme } = useAppTheme()

    const wrapper = useCallback(() => {
      return (
        <AnimatedVStack
          entering={FadeInDown.springify()
            .damping(theme.animation.spring.damping)
            .stiffness(theme.animation.spring.stiffness)
            .withInitialValues({
              transform: [
                {
                  translateY: 60,
                },
              ],
            })}
        >
          {children}
        </AnimatedVStack>
      )
    }, [children, theme.animation.spring.damping, theme.animation.spring.stiffness])

    return (
      <ConditionalWrapper condition={animateEntering} wrapper={wrapper}>
        {children}
      </ConditionalWrapper>
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

  // // For some reason, when we pass [] to data of LegendList it still calls this function with undefined?!
  // if (!message) {
  //   return ""
  // }
  // const messageContentStr = getMessageContentUniqueStringValue({
  //   messageContent: message.content,
  // })
  // const messageSentMs = convertNanosecondsToMilliseconds(message.sentNs)
  // // We assume that the max time a message can take to be sent with XMTP is 1 second.
  // const roundedMs = Math.round(messageSentMs / 1000) * 1000
  // // Doing this so that when we replace the optimistic message with the real message, the key doesn't change
  // return `${messageContentStr}-${message.senderInboxId}-${roundedMs}`
}
