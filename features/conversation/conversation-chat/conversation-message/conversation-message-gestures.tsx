import React, { memo, useCallback } from "react"
import { useConversationMessageContextMenuStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import {
  ConversationMessageGesturesDumb,
  IMessageGesturesOnLongPressArgs,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures.dumb"
import { useConversationMessageStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useReactOnMessage } from "@/features/conversation/conversation-chat/use-react-on-message.mutation"
import { useRemoveReactionOnMessage } from "@/features/conversation/conversation-chat/use-remove-reaction-on-message.mutation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useCurrentXmtpConversationIdSafe } from "../conversation.store-context"
import { getCurrentUserAlreadyReactedOnMessage } from "./utils/get-current-user-already-reacted-on-message"

export const ConversationMessageGestures = memo(function ConversationMessageGestures(props: {
  children: React.ReactNode
  onTap?: () => void
}) {
  const { children, onTap } = props

  const messageContextMenuStore = useConversationMessageContextMenuStore()
  const conversationMessageStore = useConversationMessageStore()
  const xmtpConversationId = useCurrentXmtpConversationIdSafe()

  const { reactOnMessage } = useReactOnMessage({
    xmtpConversationId,
  })

  const { removeReactionOnMessage } = useRemoveReactionOnMessage({
    xmtpConversationId,
  })

  const handleLongPress = useCallback(
    async (e: IMessageGesturesOnLongPressArgs) => {
      try {
        const messageId = conversationMessageStore.getState().currentMessageId
        messageContextMenuStore.getState().setMessageContextMenuData({
          messageId,
          itemRectX: e.pageX,
          itemRectY: e.pageY,
          itemRectHeight: e.height,
          itemRectWidth: e.width,
        })
      } catch (error) {
        captureErrorWithToast(
          new GenericError({ error, additionalMessage: "Error showing context menu" }),
          {
            message: "Error showing context menu"
          }
        )
      }
    },
    [messageContextMenuStore, conversationMessageStore],
  )

  const handleTap = useCallback(() => {
    if (onTap) {
      onTap()
      return
    }

    // Default behavior: toggle time display
    const isShowingTime = conversationMessageStore.getState().isShowingTime
    conversationMessageStore.setState({
      isShowingTime: !isShowingTime,
    })
  }, [conversationMessageStore, onTap])

  const handleDoubleTap = useCallback(() => {
    const messageId = conversationMessageStore.getState().currentMessageId
    const alreadyReacted = getCurrentUserAlreadyReactedOnMessage({
      messageId,
      emoji: "❤️",
    })
    if (alreadyReacted) {
      removeReactionOnMessage({
        messageId,
        emoji: "❤️",
      })
    } else {
      reactOnMessage({
        messageId,
        emoji: "❤️",
      })
    }
  }, [reactOnMessage, removeReactionOnMessage, conversationMessageStore])

  return (
    <ConversationMessageGesturesDumb
      onLongPress={handleLongPress}
      onTap={handleTap}
      onDoubleTap={handleDoubleTap}
    >
      {children}
    </ConversationMessageGesturesDumb>
  )
})
