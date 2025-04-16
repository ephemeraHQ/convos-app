import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { IExpoBackgroundNotificationData } from "@/features/notifications/notifications.types"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"
import { maybeDisplayLocalNewMessageNotification } from "./notifications.service"

const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK"

/**
 * Checks if the data conforms to our expected notification format
 */
function isExpoBackgroundNotification(data: any): data is IExpoBackgroundNotificationData {
  return (
    data &&
    data.body &&
    typeof data.body.contentTopic === "string" &&
    typeof data.body.encryptedMessage === "string"
  )
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

    // Skip if not in expected format
    if (!isExpoBackgroundNotification(data)) {
      notificationsLogger.debug("Ignoring notification - not in expected format")
      return
    }

    const contentTopic = data.body.contentTopic
    const encryptedMessage = data.body.encryptedMessage

    await maybeDisplayLocalNewMessageNotification({
      encryptedMessage,
      conversationTopic: contentTopic,
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
