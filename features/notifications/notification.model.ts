import * as Notifications from "expo-notifications"

export function getNotificationId(notification: Notifications.Notification) {
  return notification.request.identifier
}
