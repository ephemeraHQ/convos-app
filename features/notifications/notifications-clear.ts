import * as Notifications from "expo-notifications"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
}) {
  const { xmtpConversationId } = args

  try {
    notificationsLogger.debug(`Clearing notifications for conversation ${xmtpConversationId}...`)

    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    // Dismiss each notification
    await Promise.all(
      presentedNotifications.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    )
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: `Failed to clear notifications for conversation ${xmtpConversationId}`,
    })
  }
}
