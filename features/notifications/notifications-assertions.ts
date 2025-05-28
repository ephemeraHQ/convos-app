import * as Notifications from "expo-notifications"
import { IConversationId } from "@/features/conversation/conversation.types"
import {
  IExpoNewMessageNotification,
  INotificationMessageConverted,
} from "@/features/notifications/notifications.types"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"

export function isConvosModifiedNotification(
  notification: Notifications.Notification,
): notification is INotificationMessageConverted {
  return !!notification.request.content.data?.isProcessedByConvo
}

export function isNotificationExpoNewMessageNotification(
  notification: Notifications.Notification,
): notification is IExpoNewMessageNotification {
  return notification.request.content.data?.messageType === "v3-conversation"
}

export async function getNotificationsForConversation(args: {
  conversationId: IConversationId
  notifications: Notifications.Notification[]
}): Promise<Notifications.Notification[]> {
  const { conversationId, notifications } = args

  return notifications.filter((notification) => {
    if (isConvosModifiedNotification(notification)) {
      const notificationConversationId = getXmtpConversationIdFromXmtpTopic(
        notification.request.content.data?.topic,
      )
      return notificationConversationId === conversationId
    }

    if (isNotificationExpoNewMessageNotification(notification)) {
      const notificationConversationId = getXmtpConversationIdFromXmtpTopic(
        notification.request.content.data?.topic,
      )
      return notificationConversationId === conversationId
    }

    captureError(
      new NotificationError({
        error: new Error("Unknown notification type"),
        additionalMessage: `Unknown notification type: ${JSON.stringify(notification)}`,
      }),
    )

    return false
  })
}
