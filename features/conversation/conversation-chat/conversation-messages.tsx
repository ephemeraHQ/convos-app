import { FlashList } from "@shopify/flash-list"
import { useInfiniteQuery } from "@tanstack/react-query"
import React, { memo, ReactNode, useCallback, useEffect, useMemo, useRef } from "react"
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform } from "react-native"
import { FadeInDown, useAnimatedRef } from "react-native-reanimated"
import { ConditionalWrapper } from "@/components/conditional-wrapper"
import { AnimatedVStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationConsentPopupDm } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-dm"
import { ConversationConsentPopupGroup } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-group"
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
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { getConversationMessagesInfiniteQueryOptions } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useMarkConversationAsReadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { isTmpConversation } from "@/features/conversation/utils/tmp-conversation"
import { useDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { logger } from "@/utils/logger/logger"
import {
  useConversationStore,
  useCurrentXmtpConversationIdSafe,
} from "./conversation.store-context"

export const ConversationMessages = memo(function ConversationMessages() {
  const currentSender = useSafeCurrentSender()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()
  const refreshingRef = useRef(false)
  const scrollRef = useAnimatedRef<FlatList>()
  const conversationStore = useConversationStore()
  const hasPulledToRefreshRef = useRef(false)
  const { theme } = useAppTheme()
  const { data: settings } = useDisappearingMessageSettings({
    clientInboxId: currentSender.inboxId,
    conversationId: xmtpConversationId,
    caller: "Conversation Messages",
  })

  const {
    data: messageIds = [],
    isRefetching: isRefetchingMessages,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...getConversationMessagesInfiniteQueryOptions({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Messages",
    }),
    select: (data) => data.pages.flatMap((page) => page.messageIds),
    ...(settings?.retentionDurationInNs && {
      refetchInterval: convertNanosecondsToMilliseconds(settings.retentionDurationInNs) * 0.5,
    }),
  })

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

  // Scroll to message when we select one in the store
  useEffect(() => {
    const unsub = conversationStore.subscribe(
      (state) => state.scrollToXmtpMessageId,
      (scrollToXmtpMessageId) => {
        if (!scrollToXmtpMessageId) {
          return
        }

        const index = messageIds.findIndex((messageId) => messageId === scrollToXmtpMessageId)
        if (index === -1) {
          return
        }

        scrollRef.current?.scrollToIndex({
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
      unsub()
    }
  }, [conversationStore, scrollRef, messageIds])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // If we're already fetching, don't trigger again
      if (refreshingRef.current || isRefetchingMessages) {
        return
      }

      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent

      const contentOffsetY = contentOffset.y

      const listHeight = layoutMeasurement.height
      const listContentHeight = contentSize.height > listHeight ? listHeight : contentSize.height
      const distanceFromTop = listContentHeight - contentOffsetY
      const isPastTopThreshold = distanceFromTop < listHeight * 0.2

      if (isPastTopThreshold && hasNextPage) {
        refreshingRef.current = true
        logger.debug("Fetching older messages because we're scrolled past the top...")
        fetchNextPage()
          .then(() => {
            logger.debug("Done fetching older messages because we're scrolled past the top")
          })
          .catch(captureError)
          .finally(() => {
            refreshingRef.current = false
          })
      }

      // Reset once the user has scrolled back up past the threshold
      if (contentOffsetY >= 0) {
        hasPulledToRefreshRef.current = false
      }

      // For inverted list, we need to check if we're scrolled past the bottom to refetch latest messages
      const isPastBottomThreshold = contentOffsetY < -50

      if (isPastBottomThreshold && !hasPulledToRefreshRef.current) {
        // Only refetch if we haven't already refreshed during this pull-down gesture
        hasPulledToRefreshRef.current = true
        refreshingRef.current = true
        logger.debug("Refetching newest messages because we're scrolled past the bottom...")
        refetchMessages()
          .then(() => {
            logger.debug("Done refetching newest messages because we're scrolled past the bottom")
          })
          .catch(captureError)
          .finally(() => {
            refreshingRef.current = false
          })
      }
    },
    [fetchNextPage, hasNextPage, isRefetchingMessages, refetchMessages],
  )

  const latestXmtpMessageIdFromCurrentSender = useMemo(() => {
    return messageIds.find((xmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId,
        clientInboxId: currentSender.inboxId,
      })
      return message?.senderInboxId === currentSender.inboxId
    })
  }, [messageIds, currentSender.inboxId])

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
            })?.status === "sending"
          }
        />
      )
    },
    [currentSender.inboxId, latestXmtpMessageIdFromCurrentSender, messageIds],
  )

  const getItemType = useCallback(
    (item: IXmtpMessageId) => {
      const message = getConversationMessageQueryData({
        xmtpMessageId: item,
        clientInboxId: currentSender.inboxId,
      })

      if (!message) return "message"
      if (message.senderInboxId === currentSender.inboxId) return "outgoing"
      if (isAttachmentsMessage(message)) return "attachment"
      if (isGroupUpdatedMessage(message)) return "groupUpdate"
      return "incoming"
    },
    [currentSender.inboxId],
  )

  return (
    <FlashList
      data={messageIds}
      renderItem={renderItem}
      drawDistance={50} // Smaller because rendering messages is expensive
      estimatedItemSize={100} // Random value for now but big enough so that if we have big messages we don't have to render a lot of them
      inverted
      initialScrollIndex={0}
      keyExtractor={keyExtractor}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={Platform.OS === "ios"} // Size glitch on Android
      onScroll={handleScroll}
      scrollEventThrottle={200} // We don't need to throttle fast because we only use to know if we need to load more messages
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ConsentPopup}
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

    const { data: message } = useConversationMessageQuery({
      xmtpMessageId,
      clientInboxId: currentSender.inboxId,
      caller: "ConversationMessagesListItem",
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
    })

    const { data: nextMessage } = useConversationMessageQuery({
      xmtpMessageId: nextXmtpMessageId,
      clientInboxId: currentSender.inboxId,
      caller: "ConversationMessagesListItem",
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
          <ConversationMessageRepliable>
            <ConversationMessageLayout
              messageComp={messageComponent}
              reactionsComp={reactionsComponent}
              messageStatusComp={statusComponent}
            />
          </ConversationMessageRepliable>
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
