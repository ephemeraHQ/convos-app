import { memo, useCallback, useMemo } from "react"
import { Alert } from "react-native"
import {
  BannerContainer,
  BannerContentContainer,
  BannerSubtitle,
  BannerTitle,
} from "@/components/banner"
import { IsReadyWrapper } from "@/components/is-ready-wrapper"
import { Screen } from "@/components/screen/screen"
import { IHeaderProps } from "@/design-system/Header/Header"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationList } from "@/features/conversation/conversation-list/conversation-list.component"
import { ConversationRequestsListItemDm } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-dm"
import { ConversationRequestsListItemGroup } from "@/features/conversation/conversation-requests-list/conversation-requests-list-item-group"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { useConversationRequestsListItem } from "@/features/conversation/conversation-requests-list/use-conversation-requests-list-items"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { translate } from "@/i18n"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export const ConversationUnclearedRequestsScreen = memo(
  function ConversationUnclearedRequestsScreen() {
    useConversationUnclearedRequestsScreenHeader()
    const { likelySpamConversationIds } = useConversationRequestsListItem()

    return (
      <Screen contentContainerStyle={$globalStyles.flex1}>
        <IsReadyWrapper>
          <ConversationList
            ListHeaderComponent={<ListHeader />}
            conversationsIds={likelySpamConversationIds}
            renderConversation={({ item }) => {
              return <ConversationRequestsListItem xmtpConversationId={item} />
            }}
          />
        </IsReadyWrapper>
      </Screen>
    )
  },
)

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
        <BannerTitle>Didn't clear your security rules</BannerTitle>
        <BannerSubtitle>No links · No pics · No $</BannerSubtitle>
      </BannerContentContainer>
    </BannerContainer>
  )
})

export function useConversationUnclearedRequestsScreenHeader() {
  const router = useRouter()
  const { mutateAsync: deleteConversationsAsync, isPending } = useDeleteConversationsMutation()
  const { likelySpamConversationIds } = useConversationRequestsListItem()

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      translate("Delete all unclear requests"),
      translate("Would you like to delete all requests?"),
      [
        {
          text: translate("cancel"),
          style: "cancel",
        },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteConversationsAsync(likelySpamConversationIds)
            } catch (error) {
              captureErrorWithToast(
                new GenericError({
                  error,
                  additionalMessage: translate("Error deleting all requests"),
                }),
                {
                  message: translate("Error deleting all requests"),
                },
              )
            }
          },
        },
      ],
    )
  }, [deleteConversationsAsync, likelySpamConversationIds])

  const headerOptions = useMemo(() => {
    return {
      safeAreaEdges: ["top"],
      onBack: () => {
        router.goBack()
      },
      title: "Uncleared chats",
      RightActionComponent: (
        <HeaderAction icon="trash" onPress={handleDeleteAll} disabled={isPending} />
      ),
    } satisfies IHeaderProps
  }, [router, handleDeleteAll, isPending])

  useHeader(headerOptions, [headerOptions])
}
