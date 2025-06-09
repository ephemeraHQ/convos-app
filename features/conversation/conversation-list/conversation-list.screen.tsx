import { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { memo, useCallback } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { ContextMenuView } from "@/design-system/context-menu/context-menu"
import { HStack } from "@/design-system/HStack"
import { AnimatedVStack } from "@/design-system/VStack"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import { ConversationListItemDm } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-dm"
import { ConversationListItemGroup } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-group"
import { ConversationListItemSkeleton } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-skeleton"
import { ConversationListLoading } from "@/features/conversation/conversation-list/conversation-list-loading"
import { ConversationListPinnedConversations } from "@/features/conversation/conversation-list/conversation-list-pinned-conversations/conversation-list-pinned-conversations"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import {
  useDmConversationContextMenuViewProps,
  useGroupConversationContextMenuViewProps,
} from "@/features/conversation/conversation-list/hooks/use-conversation-list-item-context-menu-props"
import { usePinnedConversations } from "@/features/conversation/conversation-list/hooks/use-pinned-conversations"
import { refetchUnknownConsentConversationsQuery } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { NavigationParamList } from "@/navigation/navigation.types"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { ConversationListAwaitingRequests } from "./conversation-list-awaiting-requests"
import { ConversationListEmpty } from "./conversation-list-empty"
import { ConversationListStartNewConvoBanner } from "./conversation-list-start-new-convo-banner"
import { useConversationListScreenHeader } from "./conversation-list.screen-header"
import { useSortedAllowedConversationIds } from "./hooks/use-sorted-allowed-conversation-ids"

type IConversationListProps = NativeStackScreenProps<NavigationParamList, "Chats">

export const ConversationListScreen = memo(function ConversationListScreen(
  props: IConversationListProps,
) {
  const {
    data: conversationsIds,
    refetch: refetchConversations,
    isLoading: isLoadingConversations,
  } = useSortedAllowedConversationIds()

  const insets = useSafeAreaInsets()

  useConversationListScreenHeader()
  // usePreloadRecentConversations({ conversationsIds })

  const handleRefresh = useCallback(async () => {
    try {
      const currentSender = getSafeCurrentSender()
      await Promise.all([
        refetchConversations(),
        refetchUnknownConsentConversationsQuery({
          inboxId: currentSender.inboxId,
        }),
      ])
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

  const { data: conversationType } = useConversationType({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationListItem",
  })

  if (!conversationType) {
    return <ConversationListItemSkeleton />
  }

  if (conversationType === "group") {
    return <ConversationListItemGroupWrapper xmtpConversationId={xmtpConversationId} />
  }

  return <ConversationListItemDmWrapper xmtpConversationId={xmtpConversationId} />
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

  const { data: conversations } = useSortedAllowedConversationIds()
  const { pinnedConversationsIds: pinnedConversations } = usePinnedConversations()
  const hasNoConversations =
    conversations &&
    conversations.length === 0 &&
    pinnedConversations &&
    pinnedConversations.length === 0

  if (hasNoConversations) {
    return <ConversationListStartNewConvoBanner />
  }

  return (
    <AnimatedVStack layout={theme.animation.reanimatedLayoutSpringTransition}>
      <ConversationListPinnedConversations />
      <ConversationListAwaitingRequests />
    </AnimatedVStack>
  )
})

// function usePreloadRecentConversations(args: { conversationsIds: IXmtpConversationId[] }) {
//   const { conversationsIds } = args
//   const router = useRouter()
//   const currentSender = useSafeCurrentSender()
//   const preloadedConversationsRef = useRef(new Set<IXmtpConversationId>())

//   useEffectAfterInteractions(() => {
//     if (conversationsIds) {
//       conversationsIds.forEach((conversationId) => {
//         // Skip if already preloaded
//         if (preloadedConversationsRef.current.has(conversationId)) {
//           return
//         }

//         const conversation = getConversationQueryData({
//           clientInboxId: currentSender.inboxId,
//           xmtpConversationId: conversationId,
//         })

//         if (conversation) {
//           router.preload("Conversation", {
//             xmtpConversationId: conversation.xmtpId,
//           })

//           // Mark as preloaded
//           preloadedConversationsRef.current.add(conversationId)
//         }
//       })
//     }
//   }, [conversationsIds])
// }
