import * as Notifications from "expo-notifications"
import {
  IConvosModifiedNotification,
  IExpoNewMessageNotification,
} from "@/features/notifications/notifications.types"

export function isConvosModifiedNotification(
  notification: Notifications.Notification,
): notification is IConvosModifiedNotification {
  return !!notification.request.content.data?.isProcessedByConvo
}

export function isNotificationExpoNewMessageNotification(
  notification: Notifications.Notification,
): notification is IExpoNewMessageNotification {
  return notification.request.content.data?.messageType === "v3-conversation"
}
