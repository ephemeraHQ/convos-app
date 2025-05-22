import * as Notifications from "expo-notifications"
import { setConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { convertXmtpMessageToConvosMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/convert-xmtp-message-to-convos-message"
import { addMessagesToConversationMessagesInfiniteQueryData } from "@/features/conversation/conversation-chat/conversation-messages.query"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "@/features/notifications/notifications-assertions"
import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { decryptXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { groupBy } from "@/utils/array"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { ObjectTyped } from "@/utils/object-typed"
import { customPromiseAllSettled } from "@/utils/promise-all-settled"

export async function userHasGrantedNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.status === "granted"
}

export async function canAskForNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.canAskAgain
}

export function getNotificationsForConversation(args: {
  conversationId: IXmtpConversationId
  notifications: Notifications.Notification[]
}) {
  const { conversationId, notifications } = args

  return notifications.filter((notification) => {
    try {
      // Handle Convos modified notifications
      if (isConvosModifiedNotification(notification)) {
        return notification.request.content.data.message.xmtpConversationId === conversationId
      }

      // Handle Expo new message notifications
      if (isNotificationExpoNewMessageNotification(notification)) {
        const notificationConversationId = getXmtpConversationIdFromXmtpTopic(
          notification.request.content.data.contentTopic,
        )
        return notificationConversationId === conversationId
      }

      // Log unhandled notification type
      captureError(
        new NotificationError({
          error: new Error("Unknown notification type"),
          additionalMessage: `Unable to identify notification type: ${JSON.stringify(
            notification,
          )}`,
        }),
      )

      return false
    } catch (error) {
      // Capture any errors during notification filtering
      captureError(
        new NotificationError({
          error,
          additionalMessage: "Error filtering notification",
        }),
      )
      return false
    }
  })
}

export async function addNotificationsToConversationCacheData(args: {
  notifications: Notifications.Notification[]
  clientInboxId: IXmtpInboxId
}) {
  const { notifications, clientInboxId } = args

  try {
    const sortedAndValidNotifications = notifications
      .sort((a, b) => b.request.content.data.timestamp - a.request.content.data.timestamp)
      .slice(0, 15) // Too many can cause problem on the bridge

    const decryptedMessagesResults = await customPromiseAllSettled(
      sortedAndValidNotifications.map(async (notification) => {
        try {
          const conversationTopic = notification.request.content.data.contentTopic
          const xmtpConversationId = getXmtpConversationIdFromXmtpTopic(conversationTopic)

          const xmtpDecryptedMessage = await decryptXmtpMessage({
            encryptedMessage: notification.request.content.data.encryptedMessage,
            xmtpConversationId,
            clientInboxId,
          })

          if (!isSupportedXmtpMessage(xmtpDecryptedMessage)) {
            return null
          }
          return xmtpDecryptedMessage
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: `Failed to decrypt message from presented notification`,
            }),
          )
          return null
        }
      }),
    )

    const convosMessages = decryptedMessagesResults
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter(Boolean)
      .map(convertXmtpMessageToConvosMessage)

    for (const convosMessage of convosMessages) {
      setConversationMessageQueryData({
        clientInboxId,
        xmtpMessageId: convosMessage.xmtpId,
        xmtpConversationId: convosMessage.xmtpConversationId,
        message: convosMessage,
      })
    }

    const messagesGroupedByConversationId = groupBy(
      convosMessages,
      (message) => message.xmtpConversationId,
    )

    for (const [xmtpConversationId, messages] of ObjectTyped.entries(
      messagesGroupedByConversationId,
    )) {
      addMessagesToConversationMessagesInfiniteQueryData({
        clientInboxId,
        xmtpConversationId,
        messageIds: messages.map((message) => message.xmtpId),
      })
    }
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Error adding notifications to cache",
      }),
    )
  }
}
