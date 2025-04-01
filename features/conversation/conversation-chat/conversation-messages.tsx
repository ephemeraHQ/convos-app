import { LegendList } from "@legendapp/list"
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react"
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform } from "react-native"
import { useAnimatedRef } from "react-native-reanimated"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationComposerStore } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
import { ConversationConsentPopupDm } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-dm"
import { ConversationConsentPopupGroup } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-group"
import { ConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message"
import { ConversationMessageLayout } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-layout"
import { ConversationMessageReactions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions/conversation-message-reactions"
import { ConversationMessageRepliable } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-repliable"
import { ConversationMessageStatus } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-status/conversation-message-status"
import { ConversationMessageTimestamp } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-timestamp"
import { ConversationMessageContextStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import {
  mergeInfiniteQueryPages,
  useConversationMessagesInfiniteQuery,
} from "@/features/conversation/conversation-chat/conversation-messages.query"
import { getMessageContentUniqueStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useMarkConversationAsRead } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { useBetterFocusEffect } from "@/hooks/use-better-focus-effect"
import { window } from "@/theme/layout"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { isTempConversation } from "../utils/is-temp-conversation"
import { ConversationMessageHighlighted } from "./conversation-message/conversation-message-highlighted"
import { IConversationMessage } from "./conversation-message/conversation-message.types"
import { useMessageHasReactions } from "./conversation-message/hooks/use-message-has-reactions"
import { getConversationNextMessage } from "./conversation-message/utils/get-conversation-next-message"
import { getConversationPreviousMessage } from "./conversation-message/utils/get-conversation-previous-message"
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

  const {
    data,
    isRefetching: isRefetchingMessages,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
  } = useConversationMessagesInfiniteQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  const { messagesById, messagesIds, allMessagesReversed } = useMemo(() => {
    const mergedMessagesData = mergeInfiniteQueryPages(data)
    return {
      messagesById: mergedMessagesData.byId,
      messagesIds: mergedMessagesData.ids,
      allMessagesReversed: Object.values(mergedMessagesData.byId).reverse(),
    }
  }, [data])

  // Refetch messages when we focus again
  useBetterFocusEffect(
    useCallback(() => {
      if (isTempConversation(xmtpConversationId)) {
        return
      }
      refetchMessages().catch(captureError)
    }, [refetchMessages, xmtpConversationId]),
  )

  const { markAsReadAsync } = useMarkConversationAsRead({
    xmtpConversationId,
  })

  // Safer to just mark as read every time messages change
  useEffect(() => {
    if (isTempConversation(xmtpConversationId)) {
      return
    }
    markAsReadAsync().catch(captureError)
  }, [messagesIds, markAsReadAsync, xmtpConversationId])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // If we're already fetching, don't trigger again
      if (refreshingRef.current || isRefetchingMessages) {
        return
      }

      const contentOffset = e.nativeEvent.contentOffset.y

      // Calculate distance from top
      const distanceFromTop = contentOffset

      // If we're within threshold from the top, load more messages
      if (distanceFromTop < window.height * 0.5 && hasNextPage) {
        refreshingRef.current = true
        fetchNextPage()
          .catch(captureError)
          .finally(() => {
            refreshingRef.current = false
          })
      }
    },
    [fetchNextPage, hasNextPage, isRefetchingMessages],
  )

  // Scroll to message when we select one in the store
  useEffect(() => {
    const unsub = conversationStore.subscribe(
      (state) => state.scrollToXmtpMessageId,
      (scrollToXmtpMessageId) => {
        if (!scrollToXmtpMessageId) {
          return
        }

        const index = allMessagesReversed.findIndex(
          (message) => message.xmtpId === scrollToXmtpMessageId,
        )
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
  }, [conversationStore, allMessagesReversed, scrollRef])

  const renderItem = useCallback(
    ({ item, index }: { item: IConversationMessage; index: number }) => {
      const previousMessage = getConversationPreviousMessage({
        messageId: item.xmtpId,
        xmtpConversationId,
      })
      const nextMessage = getConversationNextMessage({
        messageId: item.xmtpId,
        xmtpConversationId,
      })

      return (
        <ConversationMessagesListItem
          message={item}
          previousMessage={previousMessage}
          nextMessage={nextMessage}
          // animateEntering={
          //   index === 0 &&
          //   // Need this because otherwise because our optimistic updates, we first create a dummy message with a random id
          //   // and then replace it with the real message. But the replacment triggers a new element in the list because we use messageId as key extractor
          //   // Maybe we can have a better solution in the future. Just okay for now until we either have better serialization
          //   // or have better ways to handle optimistic updates.
          //   item.status === "sending"
          // }
        />
      )
    },
    [xmtpConversationId],
  )

  return (
    <LegendList
      data={allMessagesReversed}
      renderItem={renderItem}
      estimatedItemSize={40}
      recycleItems={true}
      maintainScrollAtEnd
      alignItemsAtEnd
      maintainVisibleContentPosition
      initialScrollIndex={allMessagesReversed.length - 1}
      // getEstimatedItemSize={} // Maybe try this to fix overlapping attachments messages
      keyExtractor={keyExtractor}
      waitForInitialLayout
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={Platform.OS === "ios"} // Size glitch on Android
      style={$globalStyles.flex1}
      onScroll={handleScroll}
      scrollEventThrottle={200} // Adjust as needed for performance
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ConsentPopup}
    />
  )
})

const ConversationMessagesListItem = memo(
  function ConversationMessagesListItem(props: {
    message: IConversationMessage
    previousMessage: IConversationMessage | undefined
    nextMessage: IConversationMessage | undefined
    // animateEntering: boolean
  }) {
    const {
      message,
      previousMessage,
      nextMessage,
      // animateEntering
    } = props

    const { theme } = useAppTheme()

    const composerStore = useConversationComposerStore()

    const handleReply = useCallback(() => {
      composerStore.getState().setReplyToMessageId(message.xmtpId)
    }, [composerStore, message.xmtpId])

    const messageHasReactions = useMessageHasReactions({
      xmtpMessageId: message.xmtpId,
    })

    const messageComponent = useMemo(
      () => (
        <ConversationMessageHighlighted>
          <ConversationMessage message={message} />
        </ConversationMessageHighlighted>
      ),
      [message],
    )

    const statusComponent = useMemo(
      () => <ConversationMessageStatus messageId={message.xmtpId} />,
      [message.xmtpId],
    )

    const reactionsComponent = useMemo(
      () => (messageHasReactions ? <ConversationMessageReactions /> : null),
      [messageHasReactions],
    )

    return (
      <ConversationMessageContextStoreProvider
        message={message}
        previousMessage={previousMessage}
        nextMessage={nextMessage}
      >
        {/* <ConditionalWrapper
          condition={animateEntering}
          wrapper={(children) => (
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
          )}
        > */}
        <ConversationMessageTimestamp />
        <ConversationMessageRepliable onReply={handleReply}>
          <ConversationMessageLayout
            message={messageComponent}
            reactions={reactionsComponent}
            messageStatus={statusComponent}
          />
        </ConversationMessageRepliable>
        {/* </ConditionalWrapper> */}
      </ConversationMessageContextStoreProvider>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.message.xmtpId === nextProps.message.xmtpId
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

const keyExtractor = (message: IConversationMessage) => {
  // For some reason, when we pass [] to data of LegendList it still calls this function with undefined?!
  if (!message) {
    return ""
  }

  const messageContentStr = getMessageContentUniqueStringValue({
    messageContent: message.content,
  })
  const messageSentMs = convertNanosecondsToMilliseconds(message.sentNs)
  // We assume that the max time a message can take to be sent with XMTP is 2 seconds.
  const roundedMs = Math.round(messageSentMs / 2000) * 2000
  // Doing this so that when we replace the optimistic message with the real message, the key doesn't change
  return `${messageContentStr}-${message.senderInboxId}-${roundedMs}`
}
