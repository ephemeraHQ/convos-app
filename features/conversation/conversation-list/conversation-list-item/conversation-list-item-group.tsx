import { getCompactRelativeTime } from "@utils/date"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { GroupAvatar } from "@/components/group-avatar"
import { ISwipeableRenderActionsArgs } from "@/components/swipeable"
import { MIDDLE_DOT } from "@/design-system/middle-dot"
import { isCurrentSender, useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ConversationListItemSwipeable } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable"
import { useConversationIsUnread } from "@/features/conversation/conversation-list/hooks/use-conversation-is-unread"
import { useDeleteGroup } from "@/features/conversation/conversation-list/hooks/use-delete-group"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useToggleReadStatus } from "@/features/conversation/conversation-list/hooks/use-toggle-read-status"
import { useConversationIsMuted } from "@/features/conversation/conversation-metadata/use-conversation-is-muted"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { ensureGroupQueryData } from "@/features/groups/queries/group.query"
import {
  ensurePreferredDisplayInfo,
  usePreferredDisplayInfo,
} from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useFocusRerender } from "@/hooks/use-focus-rerender"
import { useRouter } from "@/navigation/use-navigation"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
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

  const currentSender = useSafeCurrentSender()

  // To update the timestamp when the screen comes into focus
  useFocusRerender()

  const { data: lastMessage, isLoading: isLoadingLastMessage } = useConversationLastMessage({
    xmtpConversationId,
    caller: "ConversationListItemGroup",
  })

  const { isUnread } = useConversationIsUnread({
    xmtpConversationId,
  })

  const { data: isMuted } = useConversationIsMuted({
    xmtpConversationId,
    caller: "ConversationListItemGroup",
  })

  const { groupName } = useGroupName({
    xmtpConversationId,
  })

  const { displayName: senderDisplayName } = usePreferredDisplayInfo({
    inboxId: lastMessage?.senderInboxId,
    caller: "ConversationListItemGroup",
    enabled: !isLoadingLastMessage && !!lastMessage,
    saveToNotificationExtension: true,
  })

  // Putting this in a useState because we might not care about it if we have a last message
  const [inviterDisplayName, setInviterDisplayName] = useState("")

  useEffect(() => {
    if (!isLoadingLastMessage && !lastMessage) {
      const fetchInviterInfo = async () => {
        try {
          const group = await ensureGroupQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId,
            caller: "ConversationListItemGroup",
          })

          if (group?.addedByInboxId) {
            const { displayName } = await ensurePreferredDisplayInfo({
              inboxId: group.addedByInboxId,
              caller: "ConversationListItemGroup",
              saveToNotificationExtension: true,
            })

            if (displayName) {
              setInviterDisplayName(displayName)
            }
          }
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: `Fail to get inviter display name`,
            }),
          )
        }
      }

      fetchInviterInfo()
    }
  }, [isLoadingLastMessage, lastMessage, currentSender.inboxId, xmtpConversationId])

  const onPress = useCallback(() => {
    router.navigate("Conversation", {
      xmtpConversationId,
    })
  }, [xmtpConversationId, router])

  // Title
  const title = groupName

  const messageText = useMessageContentStringValue(lastMessage)

  // Not in useMemo because we want to change the timestamp when we rerender
  const subtitle = (() => {
    if (!lastMessage) {
      if (inviterDisplayName) {
        return `${inviterDisplayName} invited you`
      }
      return "You were invited"
    }

    const timestamp = lastMessage.sentNs ?? 0
    const timeToShow = getCompactRelativeTime(timestamp)
    if (!timeToShow || !messageText) {
      return ""
    }

    // We already put the sender name in group update messages
    if (isGroupUpdatedMessage(lastMessage)) {
      return `${timeToShow} ${MIDDLE_DOT} ${messageText.trim()}`
    }

    let senderPrefix = ""
    const isCurrentUserSender =
      lastMessage.senderInboxId && isCurrentSender({ inboxId: lastMessage.senderInboxId })

    if (isCurrentUserSender) {
      senderPrefix = "You: "
    } else if (senderDisplayName) {
      senderPrefix = `${senderDisplayName}: `
    }

    return `${timeToShow} ${MIDDLE_DOT} ${senderPrefix}${messageText.trim()}`
  })()

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

  const ChildrenComponent = useMemo(
    () => (
      <ConversationListItem
        onPress={onPress}
        showError={false}
        avatarComponent={AvatarComponent}
        title={title}
        subtitle={subtitle}
        isUnread={isUnread}
        isMuted={isMuted}
      />
    ),
    [onPress, AvatarComponent, title, subtitle, isUnread, isMuted],
  )

  return (
    <ConversationListItemSwipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onLeftSwipe={onDeleteGroup}
      onRightSwipe={toggleReadStatusAsync}
    >
      {ChildrenComponent}
    </ConversationListItemSwipeable>
  )
})
