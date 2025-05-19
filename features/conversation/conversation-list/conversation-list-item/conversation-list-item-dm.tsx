import { getCompactRelativeTime } from "@utils/date"
import { memo, useCallback, useMemo } from "react"
import { Avatar } from "@/components/avatar"
import { ISwipeableRenderActionsArgs } from "@/components/swipeable"
import { MIDDLE_DOT } from "@/design-system/middle-dot"
import { isCurrentSender, useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { isTextMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ConversationListItemSwipeable } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable"
import { RestoreSwipeableAction } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable-restore-action"
import { useConversationIsDeleted } from "@/features/conversation/conversation-list/hooks/use-conversation-is-deleted"
import { useConversationIsUnread } from "@/features/conversation/conversation-list/hooks/use-conversation-is-unread"
import { useDeleteDm } from "@/features/conversation/conversation-list/hooks/use-delete-dm"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useRestoreConversation } from "@/features/conversation/conversation-list/hooks/use-restore-conversation"
import { useToggleReadStatus } from "@/features/conversation/conversation-list/hooks/use-toggle-read-status"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useDmPeerInboxId } from "@/features/conversation/hooks/use-dm-peer-inbox-id"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useFocusRerender } from "@/hooks/use-focus-rerender"
import { navigate } from "@/navigation/navigation.utils"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { ConversationListItem } from "./conversation-list-item"
import { DeleteSwipeableAction } from "./conversation-list-item-swipeable/conversation-list-item-swipeable-delete-action"
import { ToggleUnreadSwipeableAction } from "./conversation-list-item-swipeable/conversation-list-item-swipeable-toggle-read-action"

type IConversationListItemDmProps = {
  xmtpConversationId: IXmtpConversationId
}

export const ConversationListItemDm = memo(function ConversationListItemDm({
  xmtpConversationId,
}: IConversationListItemDmProps) {
  const { theme } = useAppTheme()

  // To update the timestamp when the screen comes into focus
  useFocusRerender()

  const currentSender = useSafeCurrentSender()

  const { data: peerInboxId } = useDmPeerInboxId({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "ConversationListItemDm",
  })

  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: peerInboxId,
    caller: "ConversationListItemDm",
  })

  const { isUnread } = useConversationIsUnread({ xmtpConversationId })
  const { isDeleted } = useConversationIsDeleted({ xmtpConversationId })

  const { data: lastMessage } = useConversationLastMessage({
    xmtpConversationId,
    caller: "ConversationListItemDm",
  })
  const messageText = useMessageContentStringValue(lastMessage)

  const deleteDm = useDeleteDm({ xmtpConversationId })
  const { restoreConversationAsync } = useRestoreConversation({
    xmtpConversationId,
  })
  const { toggleReadStatusAsync } = useToggleReadStatus({
    xmtpConversationId,
  })

  // Not in useMemo because we want to change the timestamp when we rerender
  const subtitle = (() => {
    if (!lastMessage || !messageText) {
      return ""
    }

    const timestamp = lastMessage.sentNs ?? 0
    const timeToShow = getCompactRelativeTime(timestamp)

    // For text messages, don't show sender name (it's obvious in a DM)
    if (isTextMessage(lastMessage)) {
      return `${timeToShow} ${MIDDLE_DOT} ${messageText.trim()}`
    }

    // For non-text messages (attachments, reactions, etc.), show who sent it
    const isCurrentUserSender =
      lastMessage.senderInboxId && isCurrentSender({ inboxId: lastMessage.senderInboxId })
    const senderPrefix = isCurrentUserSender ? "You " : displayName ? `${displayName} ` : ""

    return `${timeToShow} ${MIDDLE_DOT} ${senderPrefix}${messageText.trim()}`
  })()

  const leftActionsBackgroundColor = useMemo(
    () => (isDeleted ? theme.colors.fill.tertiary : theme.colors.fill.caution),
    [isDeleted, theme],
  )

  const handleOnPress = useCallback(() => {
    navigate("Conversation", { xmtpConversationId }).catch(captureError)
  }, [xmtpConversationId])

  const onLeftSwipe = useCallback(async () => {
    try {
      await (isDeleted ? restoreConversationAsync() : deleteDm())
    } catch (error) {
      captureErrorWithToast(new GenericError({ error, additionalMessage: "Error deleting dm" }), {
        message: "Error deleting chat",
      })
    }
  }, [isDeleted, deleteDm, restoreConversationAsync])

  const onRightSwipe = useCallback(async () => {
    try {
      await toggleReadStatusAsync()
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Error toggling read status" }),
        {
          message: "Error toggling read status",
        },
      )
    }
  }, [toggleReadStatusAsync])

  // Swipe action renderers
  const renderLeftActions = useCallback(
    (args: ISwipeableRenderActionsArgs) =>
      isDeleted ? <RestoreSwipeableAction {...args} /> : <DeleteSwipeableAction {...args} />,
    [isDeleted],
  )

  const renderRightActions = useCallback(
    (args: ISwipeableRenderActionsArgs) => (
      <ToggleUnreadSwipeableAction {...args} xmtpConversationId={xmtpConversationId} />
    ),
    [xmtpConversationId],
  )

  const AvatarComponent = useMemo(() => {
    return <Avatar sizeNumber={theme.avatarSize.lg} uri={avatarUrl} name={displayName} />
  }, [avatarUrl, displayName, theme])

  return (
    <ConversationListItemSwipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onLeftSwipe={onLeftSwipe}
      onRightSwipe={onRightSwipe}
      leftActionsBackgroundColor={leftActionsBackgroundColor}
    >
      <ConversationListItem
        onPress={handleOnPress}
        showError={false}
        avatarComponent={AvatarComponent}
        title={displayName}
        subtitle={subtitle}
        isUnread={isUnread}
      />
    </ConversationListItemSwipeable>
  )
})
