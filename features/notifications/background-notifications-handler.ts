import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { IConversationTopic } from "@/features/conversation/conversation.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { maybeDisplayLocalNewMessageNotification } from "./notifications.service"

const BACKGROUND_NOTIFICATION_TASK = "com.convos.background-notification"

/**
 * Extracts the essential notification data (contentTopic and encryptedMessage)
 * from different notification formats.
 *
 * Handles the following notification formats:
 * 1. Standard Expo format with data.body.contentTopic
 * 2. XMTP format with UIApplicationLaunchOptionsRemoteNotificationKey
 * 3. XMTP format with topic/encryptedMessage at root level
 */
function extractNotificationData(
  data: any,
): { conversationTopic: IConversationTopic; encryptedMessage: string } | null {
  // Handle standard Expo format
  if (data?.body?.contentTopic && data?.body?.encryptedMessage) {
    notificationsLogger.debug("Detected standard Expo notification format")
    return {
      conversationTopic: data.body.contentTopic as IConversationTopic,
      encryptedMessage: data.body.encryptedMessage,
    }
  }

  // Handle XMTP format with UIApplicationLaunchOptionsRemoteNotificationKey
  if (
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.body?.contentTopic &&
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.body?.encryptedMessage
  ) {
    notificationsLogger.debug("Detected XMTP notification format with nested body")
    return {
      conversationTopic: data.UIApplicationLaunchOptionsRemoteNotificationKey.body
        .contentTopic as IConversationTopic,
      encryptedMessage: data.UIApplicationLaunchOptionsRemoteNotificationKey.body.encryptedMessage,
    }
  }

  // Handle possible format with direct UIApplicationLaunchOptionsRemoteNotificationKey properties
  if (
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.topic &&
    data?.UIApplicationLaunchOptionsRemoteNotificationKey?.encryptedMessage
  ) {
    notificationsLogger.debug("Detected XMTP notification format with direct properties")
    return {
      conversationTopic: data.UIApplicationLaunchOptionsRemoteNotificationKey
        .topic as IConversationTopic,
      encryptedMessage: data.UIApplicationLaunchOptionsRemoteNotificationKey.encryptedMessage,
    }
  }

  notificationsLogger.debug("No supported notification format detected")
  return null
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

    // Extract data from notification regardless of format
    const notificationData = extractNotificationData(data)

    // Skip if not in expected format
    if (!notificationData) {
      notificationsLogger.debug("Ignoring notification - not in expected format")
      return
    }

    const { conversationTopic, encryptedMessage } = notificationData

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
