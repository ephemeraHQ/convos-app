import * as Notifications from "expo-notifications"
import { IConvosModifiedNotification } from "@/features/notifications/notifications.types"

export function isConvosModifiedNotification(
  notification: Notifications.Notification,
): notification is IConvosModifiedNotification {
  return !!notification.request.content.data?.isProcessedByConvo
}
