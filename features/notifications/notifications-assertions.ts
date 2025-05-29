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
    let topic = isConvosModifiedNotification(notification)
      ? notification.request.content.data?.message.xmtpTopic
      : isNotificationExpoNewMessageNotification(notification)
        ? notification.request.content.data?.contentTopic
        : null

    if (!topic) {
      captureError(
        new NotificationError({
          error: new Error("No topic found in notification"),
          additionalMessage: `No topic found in notification: ${JSON.stringify(notification)}`,
        }),
      )
      return false
    }

    const notificationConversationId = getXmtpConversationIdFromXmtpTopic(topic)

    return notificationConversationId === conversationId
  })
}
