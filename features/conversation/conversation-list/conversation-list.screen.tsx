import { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { memo, useCallback } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { ContextMenuView } from "@/design-system/context-menu/context-menu"
import { HStack } from "@/design-system/HStack"
import { AnimatedVStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { refetchConversationMessagesInfiniteQuery } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ConversationListItemDm } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-dm"
import { ConversationListItemGroup } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-group"
import { ConversationListLoading } from "@/features/conversation/conversation-list/conversation-list-loading"
import { ConversationListPinnedConversations } from "@/features/conversation/conversation-list/conversation-list-pinned-conversations/conversation-list-pinned-conversations"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import {
  useDmConversationContextMenuViewProps,
  useGroupConversationContextMenuViewProps,
} from "@/features/conversation/conversation-list/hooks/use-conversation-list-item-context-menu-props"
import { usePinnedConversations } from "@/features/conversation/conversation-list/hooks/use-pinned-conversations"
import {
  getConversationQueryData,
  useConversationQuery,
} from "@/features/conversation/queries/conversation.query"
import { conversationHasRecentActivities } from "@/features/conversation/utils/conversation-has-recent-activities"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useEffectWhenCondition } from "@/hooks/use-effect-once-when-condition"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { ConversationListAwaitingRequests } from "./conversation-list-awaiting-requests"
import { ConversationListEmpty } from "./conversation-list-empty"
import { ConversationListStartNewConvoBanner } from "./conversation-list-start-new-convo-banner"
import { useConversationListScreenHeader } from "./conversation-list.screen-header"
import { useConversationListConversations } from "./hooks/use-conversation-list-conversations"

type IConversationListProps = NativeStackScreenProps<NavigationParamList, "Chats">

export const ConversationListScreen = memo(function ConversationListScreen(
  props: IConversationListProps,
) {
  const {
    data: conversationsIds,
    refetch: refetchConversations,
    isLoading: isLoadingConversations,
  } = useConversationListConversations()

  const insets = useSafeAreaInsets()
  const currentSender = useSafeCurrentSender()

  // ONLY when we mount, we want to refetch messages for recent conversations
  useEffectWhenCondition(() => {
    conversationsIds?.forEach((conversationId) => {
      const conversation = getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      })

      if (
        conversation &&
        conversationHasRecentActivities({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
        })
      ) {
        logger.debug(`Refetching messages on mount for conversation ${conversationId}...`)
        refetchConversationMessagesInfiniteQuery({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId: conversationId,
          caller: "ConversationListScreen on mount refetch",
        }).catch(captureError)
      }
    })
  }, true)

  useConversationListScreenHeader()

  // Temporary comment until we solve performance issues
  // Let's preload the active conversations
  // useEffectWhenCondition(
  //   () => {
  //     for (const conversationId of conversationsIds
  //       .filter((xmtpConversationId) =>
  //         conversationHasRecentActivities({
  //           clientInboxId: currentSender.inboxId,
  //           xmtpConversationId,
  //         }),
  //       )
  //       // For now we don't want more than 5 conversations to be preloaded
  //       .slice(0, 5)) {
  //       // Preload the conversation screen
  //       // router.preload("Conversation", {
  //       //   xmtpConversationId: conversationId,
  //       // })
  //     }
  //   },
  //   Boolean(conversationsIds && conversationsIds.length > 0 && currentSender),
  // )

  const handleRefresh = useCallback(async () => {
    try {
      await refetchConversations()
    } catch (error) {
      captureError(new GenericError({ error, additionalMessage: "Error refreshing conversations" }))
    }
  }, [refetchConversations])

  const isLoading = conversationsIds?.length === 0 && isLoadingConversations

  return (
    <Screen contentContainerStyle={$globalStyles.flex1}>
      {isLoading ? (
        <ConversationListLoading />
      ) : (
        <ConversationList
          conversationsIds={conversationsIds ?? []}
          scrollEnabled={conversationsIds && conversationsIds?.length > 0}
          ListEmptyComponent={<ConversationListEmpty />}
          ListHeaderComponent={<ListHeader />}
          onRefetch={handleRefresh}
          contentContainerStyle={{
            // Little hack because we want ConversationListEmpty to be full screen when we have no conversations
            paddingBottom: conversationsIds && conversationsIds.length > 0 ? insets.bottom : 0,
          }}
          renderConversation={({ item, index }) => {
            return <ConversationListItem xmtpConversationId={item} />
          }}
        />
      )}
    </Screen>
  )
})

const ConversationListItem = memo(function ConversationListItem(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props

  const currentSender = useSafeCurrentSender()

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationListItem",
  })

  if (!conversation) {
    return null
  }

  if (isConversationGroup(conversation)) {
    return <ConversationListItemGroupWrapper xmtpConversationId={conversation.xmtpId} />
  }

  return <ConversationListItemDmWrapper xmtpConversationId={conversation.xmtpId} />
})

const ConversationListItemDmWrapper = memo(function ConversationListItemDmWrapper(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props

  const contextMenuProps = useDmConversationContextMenuViewProps({
    xmtpConversationId,
  })

  return (
    // Needed this so we don't see the shadow when long press to open the context menu
    <HStack
      style={{
        width: "100%",
        overflow: "hidden",
      }}
    >
      <ContextMenuView
        style={{
          width: "100%",
        }}
        {...contextMenuProps}
      >
        <ConversationListItemDm xmtpConversationId={xmtpConversationId} />
      </ContextMenuView>
    </HStack>
  )
})

const ConversationListItemGroupWrapper = memo(function ConversationListItemGroupWrapper(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props

  const contextMenuProps = useGroupConversationContextMenuViewProps({
    xmtpConversationId,
  })

  return (
    // Needed this so we don't see the shadow when long press to open the context menu
    <HStack
      style={{
        width: "100%",
        overflow: "hidden",
      }}
    >
      <ContextMenuView
        style={{
          width: "100%",
        }}
        {...contextMenuProps}
      >
        <ConversationListItemGroup xmtpConversationId={xmtpConversationId} />
      </ContextMenuView>
    </HStack>
  )
})

const ListHeader = React.memo(function ListHeader() {
  const { theme } = useAppTheme()

  const { data: conversations } = useConversationListConversations()
  const { pinnedConversationsIds: pinnedConversations } = usePinnedConversations()
  const hasNoConversations =
    conversations &&
    conversations.length === 0 &&
    pinnedConversations &&
    pinnedConversations.length === 0

  return (
    <AnimatedVStack layout={theme.animation.reanimatedLayoutSpringTransition}>
      {/* {ephemeralAccount && <EphemeralAccountBanner />} */}
      {hasNoConversations && <ConversationListStartNewConvoBanner />}
      <ConversationListPinnedConversations />
      <ConversationListAwaitingRequests />
    </AnimatedVStack>
  )
})
