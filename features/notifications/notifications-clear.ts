import * as Notifications from "expo-notifications"
import { getNotificationsForConversation } from "@/features/notifications/notifications-assertions"
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

    // Get notifications for this conversation only
    const conversationNotifications = await getNotificationsForConversation({
      conversationId: xmtpConversationId,
      notifications: presentedNotifications,
    })

    // Dismiss filtered notifications
    await Promise.all(
      conversationNotifications.map((notification) =>
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
