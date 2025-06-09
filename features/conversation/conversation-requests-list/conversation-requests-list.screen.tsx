import { memo, useCallback, useMemo } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  BannerContainer,
  BannerContentContainer,
  BannerSubtitle,
  BannerTitle,
} from "@/components/banner"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { Screen } from "@/components/screen/screen"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import { ConversationListItemSkeleton } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-skeleton"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import { ConversationRequestsListItemDm } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-dm"
import { ConversationRequestsListItemGroup } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-group"
import { useConversationRequestsListScreenHeader } from "@/features/conversation/conversation-requests-list/conversation-requests-list.screen-header"
import {
  invalidateUnknownConsentConversationsQuery,
  useUnknownConsentConversationsQuery,
} from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useEffectAfterInteractions } from "@/hooks/use-effect-after-interactions"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export const ConversationRequestsListScreen = memo(function () {
  const currentSender = useSafeCurrentSender()
  useConversationRequestsListScreenHeader()

  const {
    data: unknownConsentConversationIds = [],
    refetch: refetchUnknownConsentConversationIds,
  } = useUnknownConsentConversationsQuery({
    inboxId: currentSender.inboxId,
    caller: "ConversationRequestsListScreen",
  })

  const insets = useSafeAreaInsets()

  const handleRefresh = useCallback(async () => {
    try {
      await refetchUnknownConsentConversationIds()
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: "Error refreshing conversation requests list",
        }),
      )
    }
  }, [refetchUnknownConsentConversationIds])

  useEffectAfterInteractions(() => {
    invalidateUnknownConsentConversationsQuery({ inboxId: getSafeCurrentSender().inboxId }).catch(
      captureError,
    )
  }, [])

  const conversationListStyle = useMemo(() => {
    return {
      paddingBottom: insets.bottom,
    }
  }, [insets.bottom])

  return (
    <Screen contentContainerStyle={$globalStyles.flex1}>
      <IsReadyWrapper>
        <ConversationList
          contentContainerStyle={conversationListStyle}
          onRefetch={handleRefresh}
          ListHeaderComponent={<ListHeader />}
          // ListFooterComponent={
          //   unknownConsentConversationIds.length > 0 ? (
          //     <ListFooter likelySpamCount={unknownConsentConversationIds.length} />
          //   ) : undefined
          // }
          conversationsIds={unknownConsentConversationIds}
          renderConversation={({ item }) => {
            return <ConversationRequestsListItem xmtpConversationId={item} />
          }}
        />
      </IsReadyWrapper>
    </Screen>
  )
})

const ConversationRequestsListItem = memo(function ConversationRequestsListItem(props: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = props

  const currentSender = useSafeCurrentSender()

  const { data: conversationType } = useConversationType({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationRequestsListItem",
  })

  if (!conversationType) {
    return <ConversationListItemSkeleton />
  }

  if (conversationType === "group") {
    return <ConversationRequestsListItemGroup xmtpConversationId={xmtpConversationId} />
  }

  return <ConversationRequestsListItemDm xmtpConversationId={xmtpConversationId} />
})

// const ListFooter = memo(function ListFooter({ likelySpamCount }: { likelySpamCount: number }) {
//   const { theme } = useAppTheme()
//   const router = useRouter()

//   const title = useMemo(() => {
//     return <ConversationListItemTitle>Uncleared</ConversationListItemTitle>
//   }, [])

//   const subtitle = useMemo(() => {
//     const text = `${likelySpamCount} chat${likelySpamCount !== 1 ? "s" : ""}`
//     return <ConversationListItemSubtitle>{text}</ConversationListItemSubtitle>
//   }, [likelySpamCount])

//   const avatarComponent = useMemo(
//     function avatarComponent() {
//       return (
//         <VStack
//           style={{
//             width: theme.avatarSize.lg,
//             height: theme.avatarSize.lg,
//             backgroundColor: theme.colors.fill.tertiary,
//             borderRadius: 999,
//             alignItems: "center",
//             justifyContent: "center",
//           }}
//         >
//           <Icon
//             icon="exclamationmark.octagon.fill"
//             size={theme.avatarSize.lg / 2}
//             color={theme.colors.global.white}
//           />
//         </VStack>
//       )
//     },
//     [theme],
//   )

//   const previewContainerProps = useMemo(() => {
//     return {
//       style: {
//         justifyContent: "center",
//       },
//     } satisfies IVStackProps
//   }, [])

//   const handleOnPress = useCallback(() => {
//     router.navigate("ChatsRequestsUncleared")
//   }, [router])

//   return (
//     <ConversationListItem
//       onPress={handleOnPress}
//       title={title}
//       subtitle={subtitle}
//       avatarComponent={avatarComponent}
//       previewContainerProps={previewContainerProps}
//     />
//   )
// })

const ListHeader = memo(function ListHeader() {
  const { theme } = useAppTheme()

  return (
    <BannerContainer
      style={{
        marginTop: theme.spacing.xs + theme.spacing.xs,
        marginBottom: theme.spacing.xs,
        marginHorizontal: theme.spacing.lg,
      }}
    >
      <BannerContentContainer>
        <BannerTitle>Chats that clear your security rules</BannerTitle>
        <BannerSubtitle>No links · No pics · No $</BannerSubtitle>
      </BannerContentContainer>
    </BannerContainer>
  )
})
