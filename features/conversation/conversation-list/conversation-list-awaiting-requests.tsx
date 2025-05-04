import { useNavigation } from "@react-navigation/native"
import { useQueries } from "@tanstack/react-query"
import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Center } from "@/design-system/Center"
import { AnimatedHStack, HStack } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { IVStackProps } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getConversationMessageQueryOptions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  ConversationListItem,
  ConversationListItemSubtitle,
  ConversationListItemTitle,
} from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item"
import { getConversationMetadataQueryOptions } from "@/features/conversation/conversation-metadata/conversation-metadata.query"
import { useConversationRequestsListItem } from "@/features/conversation/conversation-requests-list/use-conversation-requests-list-items"
import { useConversationLastMessageIds } from "@/features/conversation/hooks/use-conversations-last-message-ids"
import { getConversationQueryOptions } from "@/features/conversation/queries/conversation.query"
import { conversationIsUnreadForInboxId } from "@/features/conversation/utils/conversation-is-unread-by-current-account"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationListAwaitingRequests = memo(function ConversationListAwaitingRequests() {
  const { theme } = useAppTheme()
  const navigation = useNavigation()
  const currentSender = useSafeCurrentSender()

  const {
    likelyNotSpamConversationIds,
    isLoading: isLoadingUknownConversations,
    refetch: refetchUnknownConversations,
  } = useConversationRequestsListItem()

  useEffect(() => {
    refetchUnknownConversations()
  }, [refetchUnknownConversations])

  // Fetch metadata queries
  const conversationsMetadataQueryResult = useQueries({
    queries: (likelyNotSpamConversationIds ?? []).map((conversationId) =>
      getConversationMetadataQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "ConversationListAwaitingRequests",
      }),
    ),
  })

  // Fetch conversation queries
  const conversationQueries = useQueries({
    queries: (likelyNotSpamConversationIds ?? []).map((conversationId) => ({
      ...getConversationQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
        caller: "ConversationListAwaitingRequests",
      }),
    })),
  })

  const { lastMessageIdByConversationId } = useConversationLastMessageIds({
    conversationIds: likelyNotSpamConversationIds,
  })

  const lastMessageIds = Object.values(lastMessageIdByConversationId)

  const lastMessageQueries = useQueries({
    queries: lastMessageIds.map((messageId) => ({
      ...getConversationMessageQueryOptions({
        clientInboxId: currentSender.inboxId,
        xmtpMessageId: messageId,
        caller: "ConversationListAwaitingRequests",
      }),
    })),
  })

  // Combine the results
  const { numberOfRequestsLikelyNotSpam, hasUnreadMessages } = useMemo(() => {
    const numberOfRequestsLikelyNotSpam = likelyNotSpamConversationIds.length

    const hasUnreadMessages = likelyNotSpamConversationIds.some((conversationId, index) => {
      const metadataQuery = conversationsMetadataQueryResult[index]
      if (!metadataQuery.data) {
        return false
      }

      const conversationQuery = conversationQueries[index]

      if (!conversationQuery.data) {
        return false
      }

      const lastMessage = lastMessageQueries.find(
        (query) => query.data?.xmtpConversationId === conversationId,
      )?.data

      return conversationIsUnreadForInboxId({
        lastMessageSentAt: lastMessage?.sentNs ?? null,
        lastMessageSenderInboxId: lastMessage?.senderInboxId ?? null,
        consumerInboxId: currentSender.inboxId,
        markedAsUnread: metadataQuery.data?.unread ?? false,
        readUntil: metadataQuery.data?.readUntil
          ? new Date(metadataQuery.data.readUntil).getTime()
          : null,
      })
    })

    return {
      numberOfRequestsLikelyNotSpam,
      hasUnreadMessages,
    }
  }, [
    likelyNotSpamConversationIds,
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    conversationsMetadataQueryResult,
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    conversationQueries,
    currentSender,
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    lastMessageQueries,
  ])

  const title = useMemo(() => {
    return (
      <HStack
        style={{
          alignItems: "center",
          columnGap: theme.spacing.xxs,
        }}
      >
        <ConversationListItemTitle>Security</ConversationListItemTitle>
      </HStack>
    )
  }, [theme])

  const subtitle = useMemo(() => {
    const getSubtitleText = () => {
      if (isLoadingUknownConversations) {
        return "Checking for invites"
      }
      return `${numberOfRequestsLikelyNotSpam} chat${numberOfRequestsLikelyNotSpam > 1 ? "s" : ""}`
    }

    const text = getSubtitleText()

    return (
      <AnimatedHStack
        key={text} // Doing this to make sure the animation is triggered
        entering={theme.animation.reanimatedFadeInSpring}
        exiting={theme.animation.reanimatedFadeOutSpring}
      >
        <ConversationListItemSubtitle>{text}</ConversationListItemSubtitle>
      </AnimatedHStack>
    )
  }, [isLoadingUknownConversations, numberOfRequestsLikelyNotSpam, theme])

  const AvatarComponent = useMemo(() => {
    return (
      <Center
        // {...debugBorder()}
        style={{
          width: theme.avatarSize.lg,
          height: theme.avatarSize.lg,
          backgroundColor: theme.colors.global.orange,
          borderRadius: theme.borderRadius.sm,
        }}
      >
        <Icon icon="shield.fill" size={theme.avatarSize.lg / 2} color={theme.colors.global.white} />
      </Center>
    )
  }, [theme])

  const handleOnPress = useCallback(() => {
    navigation.navigate("ChatsRequests")
  }, [navigation])

  const previewContainerProps = useMemo(() => {
    return {
      style: {
        justifyContent: "center",
      },
    } satisfies IVStackProps
  }, [])

  if (numberOfRequestsLikelyNotSpam === 0) {
    return null
  }

  return (
    <ConversationListItem
      title={title}
      subtitle={subtitle}
      onPress={handleOnPress}
      isUnread={hasUnreadMessages}
      avatarComponent={AvatarComponent}
      previewContainerProps={previewContainerProps}
    />
  )
})
