import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { refetchConversationMessagesInfiniteQuery } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IExpoBackgroundNotificationData } from "@/features/notifications/notifications.types"
import { getXmtpConversationIdFromXmtpTopic } from "@/features/xmtp/xmtp-conversations/xmtp-conversation"
import { IXmtpConversationTopic } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { maybeDisplayLocalNewMessageNotification } from "./notifications.service"

const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK"

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      throw new NotificationError({
        error,
      })
    }

    if (!data) {
      throw new NotificationError({
        error: "No data received in background notification task",
      })
    }

    const backgroundNotificationData = data as IExpoBackgroundNotificationData

    // Not handling other types of background notifications for now
    if (!backgroundNotificationData.body?.contentTopic) {
      return
    }

    notificationsLogger.debug("New background notification received", {
      backgroundNotificationData,
    })

    const conversationTopic = backgroundNotificationData.body.contentTopic as IXmtpConversationTopic

    // To make sure we have the latest messages
    refetchConversationMessagesInfiniteQuery({
      clientInboxId: getSafeCurrentSender().inboxId,
      xmtpConversationId: getXmtpConversationIdFromXmtpTopic(conversationTopic),
      caller: "background-notifications-handler",
    }).catch(captureError)

    await maybeDisplayLocalNewMessageNotification({
      encryptedMessage: backgroundNotificationData.body.encryptedMessage,
      conversationTopic: conversationTopic,
    })
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Error in background notification task",
        extra: {
          backgroundNotificationData: JSON.stringify(data || {}),
        },
      }),
    )
  }
})

/**
 * Register a task to handle background notifications
 * This is what allows us to process notifications even when the app is closed
 */
export async function registerBackgroundNotificationTask() {
  try {
    if (!Device.isDevice) {
      notificationsLogger.debug(
        "Skipping background notification task registration on simulator/emulator",
      )
      return
    }

    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)) {
      notificationsLogger.debug("Background notification task already registered")
      return
    }

    notificationsLogger.debug("Registering background notification task...")
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    notificationsLogger.debug("Background notification task registered successfully")
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register background notification task",
    })
  }
}
