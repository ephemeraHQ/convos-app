import * as Notifications from "expo-notifications"
import { isConvosModifiedNotification } from "@/features/notifications/notification-assertions"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

export function clearAllNotifications() {
  notificationsLogger.debug("Clearing all notifications from notification center")
  return Notifications.dismissAllNotificationsAsync()
}

export function dismissNotification(args: { identifier: string }) {
  const { identifier } = args
  notificationsLogger.debug(`Dismissing notification with identifier: ${identifier}`)
  return Notifications.dismissNotificationAsync(identifier)
}

export async function clearConversationNotifications(args: { conversationId: string }) {
  const { conversationId } = args
  notificationsLogger.debug(`Clearing notifications for conversation: ${conversationId}`)

  try {
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    const notificationIdentifiers = presentedNotifications
      .filter((notification) => {
        try {
          if (isConvosModifiedNotification(notification)) {
            return notification.request.content.data.message?.xmtpConversationId === conversationId
          }

          throw new Error(`Unknown notification type ${JSON.stringify(notification)}`)
        } catch (error) {
          captureError(
            new NotificationError({
              error,
              additionalMessage: `Error identifying notifications to clear for conversation: ${conversationId}`,
            }),
          )
          // If we can't parse the notification data, skip it
          return false
        }
      })
      .map((notification) => notification.request.identifier)

    // Dismiss each notification for this conversation
    for (const identifier of notificationIdentifiers) {
      await Notifications.dismissNotificationAsync(identifier)
    }

    notificationsLogger.debug(
      `Cleared ${notificationIdentifiers.length} notifications for conversation: ${conversationId}`,
    )

    return notificationIdentifiers.length
  } catch (error) {
    notificationsLogger.error("Failed to clear conversation notifications", error)
    throw error
  }
}
