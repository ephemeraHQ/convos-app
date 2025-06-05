import { getCompactRelativeTime } from "@utils/date"
import { memo, useCallback, useMemo } from "react"
import { Avatar } from "@/components/avatar"
import { ISwipeableRenderActionsArgs } from "@/components/swipeable"
import { MIDDLE_DOT } from "@/design-system/middle-dot"
import { isCurrentSender, useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useAllowDmMutation } from "@/features/consent/use-allow-dm.mutation"
import { isTextMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ConversationListItem } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item"
import { ConversationListItemSwipeable } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable"
import { DeleteSwipeableAction } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable-delete-action"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useDmPeerInboxId } from "@/features/conversation/hooks/use-dm-peer-inbox-id"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { EDGE_BACK_GESTURE_HIT_SLOP, navigate } from "@/navigation/navigation.utils"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IConversationRequestsListItemDmProps = {
  xmtpConversationId: IXmtpConversationId
}

export const ConversationRequestsListItemDm = memo(function ConversationRequestsListItemDm({
  xmtpConversationId,
}: IConversationRequestsListItemDmProps) {
  const { theme } = useAppTheme()

  const currentSender = useSafeCurrentSender()

  const { data: peerInboxId } = useDmPeerInboxId({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationRequestsListItemDm",
  })

  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: peerInboxId,
    caller: "ConversationRequestsListItemDm",
  })

  const { data: lastMessage } = useConversationLastMessage({
    xmtpConversationId,
    caller: "ConversationRequestsListItemDm",
  })
  const messageText = useMessageContentStringValue(lastMessage)

  const { mutateAsync: deleteConversationsAsync } = useDeleteConversationsMutation()
  const { mutateAsync: allowDmAsync } = useAllowDmMutation()

  const subtitle = useMemo(() => {
    if (!lastMessage || !messageText) {
      return ""
    }

    const timestamp = lastMessage.sentNs ?? 0
    const timeToShow = getCompactRelativeTime(timestamp)

    if (isTextMessage(lastMessage)) {
      return `${timeToShow} ${MIDDLE_DOT} ${messageText.trim()}`
    }

    const isCurrentUserSender =
      lastMessage.senderInboxId && isCurrentSender({ inboxId: lastMessage.senderInboxId })
    const senderPrefix = isCurrentUserSender ? "You " : displayName ? `${displayName} ` : ""

    return `${timeToShow} ${MIDDLE_DOT} ${senderPrefix}${messageText.trim()}`
  }, [lastMessage, messageText, displayName])

  const handleOnPress = useCallback(() => {
    navigate("Conversation", { xmtpConversationId }).catch(captureError)
  }, [xmtpConversationId])

  const onLeftSwipe = useCallback(async () => {
    try {
      await deleteConversationsAsync([xmtpConversationId])
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Error deleting conversation request" }),
        {
          message: "Error deleting request",
        },
      )
    }
  }, [deleteConversationsAsync, xmtpConversationId])

  const onRightSwipe = useCallback(async () => {
    try {
      await allowDmAsync({ xmtpConversationId })
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Error accepting conversation request" }),
        {
          message: "Error accepting request",
        },
      )
    }
  }, [allowDmAsync, xmtpConversationId])

  const renderLeftActions = useCallback((args: ISwipeableRenderActionsArgs) => {
    return <DeleteSwipeableAction {...args} />
  }, [])

  const AvatarComponent = useMemo(() => {
    return <Avatar sizeNumber={theme.avatarSize.lg} uri={avatarUrl} name={displayName} />
  }, [avatarUrl, displayName, theme])

  const ChildrenComponent = useMemo(
    () => (
      <ConversationListItem
        onPress={handleOnPress}
        showError={false}
        avatarComponent={AvatarComponent}
        title={displayName}
        subtitle={subtitle}
      />
    ),
    [handleOnPress, AvatarComponent, displayName, subtitle],
  )

  return (
    <ConversationListItemSwipeable
      leftHitSlop={-EDGE_BACK_GESTURE_HIT_SLOP}
      renderLeftActions={renderLeftActions}
      onLeftSwipe={onLeftSwipe}
      onRightSwipe={onRightSwipe}
    >
      {ChildrenComponent}
    </ConversationListItemSwipeable>
  )
})
