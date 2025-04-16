import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { IXmtpConversationTopic } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { maybeDisplayLocalNewMessageNotification } from "./notifications.service"

const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK"

/**
 * Extracts essential notification data (contentTopic and encryptedMessage)
 * regardless of whether it's in XMTP or Expo format
 */
function extractNotificationData(data: any) {
  // Handle case where data is nested under backgroundNotificationData
  if (data.backgroundNotificationData) {
    return extractNotificationData(data.backgroundNotificationData)
  }

  // Handle XMTP format with UIApplicationLaunchOptionsRemoteNotificationKey
  if (data.UIApplicationLaunchOptionsRemoteNotificationKey) {
    const xmtpData = data.UIApplicationLaunchOptionsRemoteNotificationKey

    // If it has body structure
    if (xmtpData.body?.contentTopic && xmtpData.body?.encryptedMessage) {
      return {
        contentTopic: xmtpData.body.contentTopic,
        encryptedMessage: xmtpData.body.encryptedMessage,
      }
    }

    // Handle case where values are at root level of XMTP data
    if (xmtpData.topic && xmtpData.encryptedMessage) {
      return {
        contentTopic: xmtpData.topic,
        encryptedMessage: xmtpData.encryptedMessage,
      }
    }
  }

  // Handle standard Expo format
  if (data.body?.contentTopic && data.body?.encryptedMessage) {
    return {
      contentTopic: data.body.contentTopic,
      encryptedMessage: data.body.encryptedMessage,
    }
  }

  // Return empty object if no matching format found
  return {}
}

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

    notificationsLogger.debug("Received background notification data", {
      data,
    })

    // Extract only the needed notification data regardless of format
    const { contentTopic, encryptedMessage } = extractNotificationData(data)

    notificationsLogger.debug("Extracted notification data", {
      contentTopic,
      hasEncryptedMessage: !!encryptedMessage,
    })

    // Skip if missing required data
    if (!contentTopic || !encryptedMessage) {
      notificationsLogger.debug("Missing required notification data, skipping", {
        hasContentTopic: !!contentTopic,
        hasEncryptedMessage: !!encryptedMessage,
      })
      return
    }

    notificationsLogger.debug("Processing background notification")

    const conversationTopic = contentTopic as IXmtpConversationTopic

    await maybeDisplayLocalNewMessageNotification({
      encryptedMessage,
      conversationTopic,
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
