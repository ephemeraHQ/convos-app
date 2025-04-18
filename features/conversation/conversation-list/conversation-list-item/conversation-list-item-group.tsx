import { getCompactRelativeTime } from "@utils/date"
import { memo, useCallback, useMemo } from "react"
import { GroupAvatar } from "@/components/group-avatar"
import { ISwipeableRenderActionsArgs } from "@/components/swipeable"
import { MIDDLE_DOT } from "@/design-system/middle-dot"
import { isCurrentSender } from "@/features/authentication/multi-inbox.store"
import { isTextMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ConversationListItemSwipeable } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable"
import { useConversationIsUnread } from "@/features/conversation/conversation-list/hooks/use-conversation-is-unread"
import { useDeleteGroup } from "@/features/conversation/conversation-list/hooks/use-delete-group"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useToggleReadStatus } from "@/features/conversation/conversation-list/hooks/use-toggle-read-status"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useRouter } from "@/navigation/use-navigation"
import { ConversationListItem } from "./conversation-list-item"
import { DeleteSwipeableAction } from "./conversation-list-item-swipeable/conversation-list-item-swipeable-delete-action"
import { ToggleUnreadSwipeableAction } from "./conversation-list-item-swipeable/conversation-list-item-swipeable-toggle-read-action"

type IConversationListItemGroupProps = {
  xmtpConversationId: IXmtpConversationId
}

export const ConversationListItemGroup = memo(function ConversationListItemGroup({
  xmtpConversationId,
}: IConversationListItemGroupProps) {
  const router = useRouter()

  const { data: lastMessage } = useConversationLastMessage({
    xmtpConversationId,
  })

  const { isUnread } = useConversationIsUnread({
    xmtpConversationId,
  })

  const { groupName } = useGroupName({
    xmtpConversationId,
  })

  const { displayName: senderDisplayName } = usePreferredDisplayInfo({
    inboxId: lastMessage?.senderInboxId,
  })

  const onPress = useCallback(() => {
    router.navigate("Conversation", {
      xmtpConversationId,
    })
  }, [xmtpConversationId, router])

  // Title
  const title = groupName

  const messageText = useMessageContentStringValue(lastMessage)

  // Subtitle with sender info
  const subtitle = useMemo(() => {
    if (!lastMessage) return ""

    const timestamp = lastMessage.sentNs ?? 0
    const timeToShow = getCompactRelativeTime(timestamp)
    if (!timeToShow || !messageText) return ""

    let senderPrefix = ""
    const isCurrentUserSender =
      lastMessage.senderInboxId && isCurrentSender({ inboxId: lastMessage.senderInboxId })

    if (isCurrentUserSender) {
      senderPrefix = "You: "
    } else if (senderDisplayName) {
      senderPrefix = isTextMessage(lastMessage) ? `${senderDisplayName}: ` : `${senderDisplayName} `
    }

    return `${timeToShow} ${MIDDLE_DOT} ${senderPrefix}${messageText.trim()}`
  }, [lastMessage, messageText, senderDisplayName])

  const { toggleReadStatusAsync } = useToggleReadStatus({
    xmtpConversationId,
  })

  const renderLeftActions = useCallback((args: ISwipeableRenderActionsArgs) => {
    return <DeleteSwipeableAction {...args} />
  }, [])

  const renderRightActions = useCallback(
    (args: ISwipeableRenderActionsArgs) => {
      return <ToggleUnreadSwipeableAction {...args} xmtpConversationId={xmtpConversationId} />
    },
    [xmtpConversationId],
  )

  const onDeleteGroup = useDeleteGroup({
    xmtpConversationId,
  })

  const AvatarComponent = useMemo(() => {
    return <GroupAvatar size="lg" xmtpConversationId={xmtpConversationId} />
  }, [xmtpConversationId])

  return (
    <ConversationListItemSwipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onLeftSwipe={onDeleteGroup}
      onRightSwipe={toggleReadStatusAsync}
    >
      <ConversationListItem
        onPress={onPress}
        showError={false}
        avatarComponent={AvatarComponent}
        title={title}
        subtitle={subtitle}
        isUnread={isUnread}
      />
    </ConversationListItemSwipeable>
  )
})
