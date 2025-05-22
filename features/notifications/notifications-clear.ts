import * as Notifications from "expo-notifications"
import {
  addNotificationsToConversationCacheData,
  getNotificationsForConversation,
} from "@/features/notifications/notifications.service"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}) {
  const { xmtpConversationId, clientInboxId } = args

  try {
    notificationsLogger.debug(`Clearing notifications for conversation ${xmtpConversationId}...`)

    // Get all current notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    notificationsLogger.debug(
      `Found ${presentedNotifications.length} notifications in the notification center to process`,
    )

    const notificationsForConversation = getNotificationsForConversation({
      conversationId: xmtpConversationId,
      notifications: presentedNotifications,
    })

    if (notificationsForConversation.length === 0) {
      notificationsLogger.debug(
        `No notifications to clear found for conversation ${xmtpConversationId}`,
      )
      return
    }

    notificationsLogger.debug(
      `Found ${notificationsForConversation.length} notifications to clear for conversation ${xmtpConversationId}`,
    )

    // Make sure notifications are in the conversation messages... They should already be but just in case
    addNotificationsToConversationCacheData({
      notifications: notificationsForConversation,
      clientInboxId,
    }).catch(captureError)

    // Dismiss each notification
    await Promise.all(
      notificationsForConversation.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    )

    notificationsLogger.debug(
      `Successfully cleared ${notificationsForConversation.length} notifications for conversation ${xmtpConversationId}`,
    )
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: `Failed to clear notifications for conversation ${xmtpConversationId}`,
    })
  }
}
