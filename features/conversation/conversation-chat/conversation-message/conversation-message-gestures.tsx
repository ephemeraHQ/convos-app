import React, { memo, useCallback } from "react"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationMessageContextMenuStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import {
  ConversationMessageGesturesDumb,
  IMessageGesturesOnLongPressArgs,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures.dumb"
import { useConversationMessageStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { isMultiRemoteAttachmentMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { getMessageFromConversationSafe } from "@/features/conversation/conversation-chat/conversation-message/utils/get-message-from-conversation"
import { useReactOnMessage } from "@/features/conversation/conversation-chat/use-react-on-message.mutation"
import { useRemoveReactionOnMessage } from "@/features/conversation/conversation-chat/use-remove-reaction-on-message.mutation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useCurrentXmtpConversationIdSafe } from "../conversation.store-context"
import { getCurrentUserAlreadyReactedOnMessage } from "./utils/get-current-user-already-reacted-on-message"

export const ConversationMessageGestures = memo(function ConversationMessageGestures(props: {
  children: React.ReactNode
  contextMenuExtra?: Record<string, any> // Not best but okay for now
}) {
  const { contextMenuExtra, children } = props

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
        const currentSender = getSafeCurrentSender()
        const messageId = conversationMessageStore.getState().currentMessageId
        const message = getMessageFromConversationSafe({
          messageId,
          clientInboxId: currentSender.inboxId,
        })
        messageContextMenuStore.getState().setMessageContextMenuData({
          messageId,
          itemRectX: e.pageX,
          itemRectY: e.pageY,
          itemRectHeight: e.height,
          itemRectWidth: e.width,
          ...(isMultiRemoteAttachmentMessage(message) && {
            extra: {
              attachmentUrl: contextMenuExtra?.attachmentUrl,
            },
          }),
        })
      } catch (error) {
        captureErrorWithToast(
          new GenericError({ error, additionalMessage: "Error showing context menu" }),
        )
      }
    },
    [messageContextMenuStore, conversationMessageStore, contextMenuExtra],
  )

  const handleTap = useCallback(() => {
    // If this is an image attachment with a viewer handler, open it
    if (contextMenuExtra?.openAttachmentViewer && typeof contextMenuExtra.openAttachmentViewer === 'function') {
      try {
        contextMenuExtra.openAttachmentViewer()
        return
      } catch (error) {
        console.error("Error opening attachment viewer:", error)
      }
    }
    
    // Default behavior: toggle time display
    const isShowingTime = conversationMessageStore.getState().isShowingTime
    conversationMessageStore.setState({
      isShowingTime: !isShowingTime,
    })
  }, [conversationMessageStore, contextMenuExtra])

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
