import { getCompactRelativeTime } from "@utils/date"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { GroupAvatar } from "@/components/group-avatar"
import { ISwipeableRenderActionsArgs } from "@/components/swipeable"
import { MIDDLE_DOT } from "@/design-system/middle-dot"
import { isCurrentSender, useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { ConversationListItem } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item"
import { ConversationListItemSwipeable } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable"
import { DeleteSwipeableAction } from "@/features/conversation/conversation-list/conversation-list-item/conversation-list-item-swipeable/conversation-list-item-swipeable-delete-action"
import { useMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { useConversationLastMessage } from "@/features/conversation/hooks/use-conversation-last-message"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { ensureGroupQueryData } from "@/features/groups/queries/group.query"
import {
  ensurePreferredDisplayInfo,
  usePreferredDisplayInfo,
} from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { EDGE_BACK_GESTURE_HIT_SLOP } from "@/navigation/navigation.utils"
import { useRouter } from "@/navigation/use-navigation"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IConversationRequestsListItemGroupProps = {
  xmtpConversationId: IXmtpConversationId
}

export const ConversationRequestsListItemGroup = memo(function ConversationRequestsListItemGroup({
  xmtpConversationId,
}: IConversationRequestsListItemGroupProps) {
  const router = useRouter()
  const currentSender = useSafeCurrentSender()

  const { data: lastMessage, isLoading: isLoadingLastMessage } = useConversationLastMessage({
    xmtpConversationId,
    caller: "ConversationRequestsListItemGroup",
  })

  const { groupName } = useGroupName({
    xmtpConversationId,
  })

  const { displayName: senderDisplayName } = usePreferredDisplayInfo({
    inboxId: lastMessage?.senderInboxId,
    caller: "ConversationRequestsListItemGroup",
    enabled: !isLoadingLastMessage && !!lastMessage,
  })

  const [inviterDisplayName, setInviterDisplayName] = useState("")

  const { mutateAsync: deleteConversationsAsync } = useDeleteConversationsMutation()
  useEffect(() => {
    if (!isLoadingLastMessage && !lastMessage) {
      let isMounted = true

      const fetchInviterInfo = async () => {
        try {
          const group = await ensureGroupQueryData({
            clientInboxId: currentSender.inboxId,
            xmtpConversationId,
            caller: "ConversationRequestsListItemGroup",
          })

          if (group?.addedByInboxId) {
            const { displayName } = await ensurePreferredDisplayInfo({
              inboxId: group.addedByInboxId,
              caller: "ConversationRequestsListItemGroup",
            })

            if (displayName && isMounted) {
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

      return () => {
        isMounted = false
      }
    }
  }, [isLoadingLastMessage, lastMessage, currentSender.inboxId, xmtpConversationId])

  const onPress = useCallback(() => {
    router.navigate("Conversation", {
      xmtpConversationId,
    })
  }, [xmtpConversationId, router])

  const title = groupName
  const messageText = useMessageContentStringValue(lastMessage)

  const subtitle = useMemo(() => {
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
  }, [inviterDisplayName, lastMessage, messageText, senderDisplayName])

  const onLeftSwipe = useCallback(async () => {
    try {
      await deleteConversationsAsync([xmtpConversationId])
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Error deleting group request" }),
        {
          message: "Error deleting request",
        },
      )
    }
  }, [deleteConversationsAsync, xmtpConversationId])

  const renderLeftActions = useCallback((args: ISwipeableRenderActionsArgs) => {
    return <DeleteSwipeableAction {...args} />
  }, [])

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
      />
    ),
    [onPress, AvatarComponent, title, subtitle],
  )

  return (
    <ConversationListItemSwipeable
      leftHitSlop={-EDGE_BACK_GESTURE_HIT_SLOP}
      renderLeftActions={renderLeftActions}
      onLeftSwipe={onLeftSwipe}
    >
      {ChildrenComponent}
    </ConversationListItemSwipeable>
  )
})
