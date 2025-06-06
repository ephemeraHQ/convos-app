import { useNavigation } from "@react-navigation/native"
import React, { memo, useCallback, useMemo } from "react"
import { Center } from "@/design-system/Center"
import { AnimatedHStack, HStack } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { IVStackProps } from "@/design-system/VStack"
import {
  ConversationListItem,
  ConversationListItemSubtitle,
  ConversationListItemTitle,
} from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item"
import { useConversationRequestsCount } from "@/features/conversation/conversation-requests-list/use-conversation-requests-count"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationListAwaitingRequests = memo(function ConversationListAwaitingRequests() {
  const { theme } = useAppTheme()
  const navigation = useNavigation()

  const {
    data: numberOfRequests,
    isLoading: isLoadingUnknownConversations,
    isFetching: isFetchingUnknownConversations,
  } = useConversationRequestsCount()

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
      if (isLoadingUnknownConversations || isFetchingUnknownConversations) {
        return "Checking for invites"
      }
      return `${numberOfRequests} chat${numberOfRequests > 1 ? "s" : ""}`
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
  }, [isLoadingUnknownConversations, isFetchingUnknownConversations, numberOfRequests, theme])

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

  if (numberOfRequests === 0) {
    return null
  }

  return (
    <ConversationListItem
      title={title}
      subtitle={subtitle}
      onPress={handleOnPress}
      isUnread={false}
      avatarComponent={AvatarComponent}
      previewContainerProps={previewContainerProps}
    />
  )
})
