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
import { Icon } from "@/design-system/Icon/Icon"
import { IVStackProps, VStack } from "@/design-system/VStack"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import {
  ConversationListItem,
  ConversationListItemSubtitle,
  ConversationListItemTitle,
} from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import { ConversationRequestsListItemDm } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-dm"
import { ConversationRequestsListItemGroup } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-group"
import { useConversationRequestsListScreenHeader } from "@/features/conversation/conversation-requests-list/conversation-requests-list.screen-header"
import { invalidateUnknownConsentConversationsQuery } from "@/features/conversation/conversation-requests-list/conversations-unknown-consent.query"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useEffectOnce } from "@/hooks/use-effect-once"
import { useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useConversationRequestsListItem } from "./use-conversation-requests-list-items"

export const ConversationRequestsListScreen = memo(function () {
  useConversationRequestsListScreenHeader()

  const {
    likelyNotSpamConversationIds,
    likelySpamConversationIds,
    refetch: refetchConversationRequestsListItem,
  } = useConversationRequestsListItem()

  const insets = useSafeAreaInsets()

  const handleRefresh = useCallback(async () => {
    try {
      await refetchConversationRequestsListItem()
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: "Error refreshing conversation requests list",
        }),
      )
    }
  }, [refetchConversationRequestsListItem])

  useEffectOnce(() => {
    invalidateUnknownConsentConversationsQuery({ inboxId: getSafeCurrentSender().inboxId }).catch(
      captureError,
    )
  })

  return (
    <Screen contentContainerStyle={$globalStyles.flex1}>
      <IsReadyWrapper>
        <ConversationList
          contentContainerStyle={{
            paddingBottom: insets.bottom,
          }}
          onRefetch={handleRefresh}
          ListHeaderComponent={<ListHeader />}
          ListFooterComponent={
            likelySpamConversationIds.length > 0 ? (
              <ListFooter likelySpamCount={likelySpamConversationIds.length} />
            ) : undefined
          }
          conversationsIds={likelyNotSpamConversationIds}
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

  const { data: conversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationRequestsListItem",
  })

  if (!conversation) {
    return null
  }

  if (isConversationGroup(conversation)) {
    return <ConversationRequestsListItemGroup xmtpConversationId={conversation.xmtpId} />
  }

  return <ConversationRequestsListItemDm xmtpConversationId={conversation.xmtpId} />
})

const ListFooter = memo(function ListFooter({ likelySpamCount }: { likelySpamCount: number }) {
  const { theme } = useAppTheme()
  const router = useRouter()

  const title = useMemo(() => {
    return <ConversationListItemTitle>Uncleared</ConversationListItemTitle>
  }, [])

  const subtitle = useMemo(() => {
    const text = `${likelySpamCount} chat${likelySpamCount !== 1 ? "s" : ""}`
    return <ConversationListItemSubtitle>{text}</ConversationListItemSubtitle>
  }, [likelySpamCount])

  const avatarComponent = useMemo(
    function avatarComponent() {
      return (
        <VStack
          style={{
            width: theme.avatarSize.lg,
            height: theme.avatarSize.lg,
            backgroundColor: theme.colors.fill.tertiary,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            icon="exclamationmark.octagon.fill"
            size={theme.avatarSize.lg / 2}
            color={theme.colors.global.white}
          />
        </VStack>
      )
    },
    [theme],
  )

  const previewContainerProps = useMemo(() => {
    return {
      style: {
        justifyContent: "center",
      },
    } satisfies IVStackProps
  }, [])

  const handleOnPress = useCallback(() => {
    router.navigate("ChatsRequestsUncleared")
  }, [router])

  return (
    <ConversationListItem
      onPress={handleOnPress}
      title={title}
      subtitle={subtitle}
      avatarComponent={avatarComponent}
      previewContainerProps={previewContainerProps}
    />
  )
})

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
