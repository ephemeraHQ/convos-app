import * as Notifications from "expo-notifications"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import {
  isConvosModifiedNotification,
  isNotificationExpoNewMessageNotification,
} from "./notifications-assertions"

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
}) {
  try {
    notificationsLogger.debug("Clearing notifications for conversation:", args.xmtpConversationId)

    // Get all current notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    notificationsLogger.debug(
      `Found ${presentedNotifications.length} notifications present in tray`,
      JSON.stringify(presentedNotifications),
    )

    if (presentedNotifications.length === 0) {
      notificationsLogger.debug("No notifications to clear")
      return
    }

    // Find notifications related to this conversation
    const notificationsToRemove = presentedNotifications.filter((notification) => {
      try {
        // Handle Convos modified notifications
        if (isConvosModifiedNotification(notification)) {
          return (
            notification.request.content.data.message.xmtpConversationId === args.xmtpConversationId
          )
        }

        // Handle Expo new message notifications
        if (isNotificationExpoNewMessageNotification(notification)) {
          return notification.request.content.data.xmtpConversationId === args.xmtpConversationId
        }

        // Log unhandled notification type
        captureError(
          new NotificationError({
            error: new Error("Unknown notification type"),
            additionalMessage: `Unable to identify notification type: ${JSON.stringify(
              notification.request.content.data,
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

    if (notificationsToRemove.length === 0) {
      notificationsLogger.debug(
        `No notifications to clear found for conversation ${args.xmtpConversationId}`,
      )
      return
    }

    notificationsLogger.debug(
      `Found ${notificationsToRemove.length} notifications to clear for conversation ${args.xmtpConversationId}`,
    )

    // Dismiss each notification
    await Promise.all(
      notificationsToRemove.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    )

    notificationsLogger.debug(
      `Successfully cleared ${notificationsToRemove.length} notifications for conversation ${args.xmtpConversationId}`,
    )
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: `Failed to clear notifications for conversation ${args.xmtpConversationId}`,
    })
  }
}
