import { LegendList } from "@legendapp/list"
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react"
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform } from "react-native"
import { useAnimatedRef } from "react-native-reanimated"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationConsentPopupDm } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-dm"
import { ConversationConsentPopupGroup } from "@/features/conversation/conversation-chat/conversation-consent-popup/conversation-consent-popup-group"
import { ConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message"
import { ConversationMessageLayout } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-layout"
import { ConversationMessageReactions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions/conversation-message-reactions"
import { ConversationMessageRepliable } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-repliable"
import { ConversationMessageStatus } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-status/conversation-message-status"
import { ConversationMessageTimestamp } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-timestamp"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { ConversationMessageContextStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useIsLatestMessageByCurrentUser } from "@/features/conversation/conversation-chat/conversation-message/hooks/use-message-is-latest-sent-by-current-user"
import { useConversationMessagesInfiniteQueryAllMessageIds } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { useMarkConversationAsReadMutation } from "@/features/conversation/hooks/use-mark-conversation-as-read"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationAllowed } from "@/features/conversation/utils/is-conversation-allowed"
import { isConversationDm } from "@/features/conversation/utils/is-conversation-dm"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useBetterFocusEffect } from "@/hooks/use-better-focus-effect"
import { window } from "@/theme/layout"
import { $globalStyles } from "@/theme/styles"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { isTempConversation } from "../utils/temp-conversation"
import { ConversationMessageHighlighted } from "./conversation-message/conversation-message-highlighted"
import { useMessageHasReactions } from "./conversation-message/hooks/use-message-has-reactions"
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
    data: messageIds = [],
    isRefetching: isRefetchingMessages,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
  } = useConversationMessagesInfiniteQueryAllMessageIds({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  const messageIdsReversed = useMemo(() => {
    return [...messageIds].reverse()
  }, [messageIds])

  useEffect(() => {
    // When unmounted, refetch messages to make sure the tmp messages are replaced
    return () => {
      refetchMessages().catch(captureError)
    }
  }, [refetchMessages])

  // Refetch messages when we focus again
  useBetterFocusEffect(
    useCallback(() => {
      if (isTempConversation(xmtpConversationId)) {
        return
      }
      refetchMessages().catch(captureError)
    }, [refetchMessages, xmtpConversationId]),
  )

  const { mutateAsync: markAsReadAsync } = useMarkConversationAsReadMutation({
    xmtpConversationId,
    caller: "Conversation Messages",
  })

  const latestMessageId = useMemo(() => {
    return messageIds[messageIds.length - 1]
  }, [messageIds])

  // Safer to just mark as read every time messages change
  useEffect(() => {
    if (isTempConversation(xmtpConversationId)) {
      return
    }
    markAsReadAsync().catch(captureError)
  }, [latestMessageId, markAsReadAsync, xmtpConversationId])

  // Scroll to message when we select one in the store
  useEffect(() => {
    const unsub = conversationStore.subscribe(
      (state) => state.scrollToXmtpMessageId,
      (scrollToXmtpMessageId) => {
        if (!scrollToXmtpMessageId) {
          return
        }

        const index = messageIdsReversed.findIndex(
          (messageId) => messageId === scrollToXmtpMessageId,
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
  }, [conversationStore, messageIdsReversed, scrollRef])

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

  const renderItem = useCallback(
    ({ item, index }: { item: IXmtpMessageId; index: number }) => {
      // const previousMessage = getConversationPreviousMessage({
      //   messageId: item.xmtpId,
      //   xmtpConversationId,
      // })

      // const nextMessage = getConversationNextMessage({
      //   messageId: item.xmtpId,
      //   xmtpConversationId,
      // })

      const previousXmtpMessageId = messageIdsReversed[index + 1]
      const nextXmtpMessageId = messageIdsReversed[index - 1]

      return (
        <ConversationMessagesListItem
          // message={item}
          xmtpMessageId={item}
          previousXmtpMessageId={previousXmtpMessageId}
          nextXmtpMessageId={nextXmtpMessageId}
          // previousMessage={previousMessage}
          // nextMessage={nextMessage}
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
    [messageIdsReversed],
  )

  return (
    <LegendList
      data={messageIdsReversed}
      renderItem={renderItem}
      estimatedItemSize={60}
      recycleItems={true}
      maintainScrollAtEnd
      alignItemsAtEnd
      maintainVisibleContentPosition
      initialScrollIndex={messageIdsReversed.length - 1}
      // getEstimatedItemSize={} // Maybe try this to fix overlapping attachments messages
      keyExtractor={keyExtractor}
      waitForInitialLayout
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={Platform.OS === "ios"} // Size glitch on Android
      style={$globalStyles.flex1}
      onScroll={handleScroll}
      scrollEventThrottle={200} // We don't need to throttle fast because we only use to know if we need to load more messages
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ConsentPopup}
    />
  )
})

const ConversationMessagesListItem = memo(
  function ConversationMessagesListItem(props: {
    xmtpMessageId: IXmtpMessageId
    previousXmtpMessageId: IXmtpMessageId | undefined
    nextXmtpMessageId: IXmtpMessageId | undefined
    // message: IConversationMessage
    // previousMessage: IConversationMessage | undefined
    // nextMessage: IConversationMessage | undefined
    // animateEntering: boolean
  }) {
    const {
      xmtpMessageId,
      previousXmtpMessageId,
      nextXmtpMessageId,
      // message,
      // previousMessage,
      // nextMessage,
      // animateEntering
    } = props

    const currentSender = useSafeCurrentSender()

    const { data: message } = useConversationMessageQuery({
      xmtpMessageId,
      clientInboxId: currentSender.inboxId,
    })

    const messageHasReactions = useMessageHasReactions({
      xmtpMessageId,
    })

    const isLatestMessageByCurrentUser = useIsLatestMessageByCurrentUser(xmtpMessageId)

    const messageComponent = useMemo(
      () => (
        <ConversationMessageHighlighted>
          <ConversationMessage />
        </ConversationMessageHighlighted>
      ),
      [],
    )

    const statusComponent = useMemo(
      () => (isLatestMessageByCurrentUser ? <ConversationMessageStatus /> : null),
      [isLatestMessageByCurrentUser],
    )

    const reactionsComponent = useMemo(
      () => (messageHasReactions ? <ConversationMessageReactions /> : null),
      [messageHasReactions],
    )

    const { data: previousMessage } = useConversationMessageQuery({
      xmtpMessageId: previousXmtpMessageId,
      clientInboxId: currentSender.inboxId,
    })

    const { data: nextMessage } = useConversationMessageQuery({
      xmtpMessageId: nextXmtpMessageId,
      clientInboxId: currentSender.inboxId,
    })

    if (!message) {
      captureError(new GenericError({ error: "Message not found, this shouldn't happen" }))
      return null
    }

    return (
      <ConversationMessageContextStoreProvider
        message={message}
        previousMessage={previousMessage ?? undefined}
        nextMessage={nextMessage ?? undefined}
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
        <ConversationMessageRepliable>
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
  // (prevProps, nextProps) => {
  //   return prevProps.xmtpMessageId === nextProps.xmtpMessageId
  //   // return nextProps.message.xmtpId === prevProps.message.xmtpId
  //   // Make sure to not re-render when the message is the same
  //   // return keyExtractor(prevProps.message) === keyExtractor(nextProps.message)
  // },
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
