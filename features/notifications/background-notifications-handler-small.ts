import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { getAppConfig } from "@/features/app-settings/app-settings.api"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { authLogger, logger } from "@/utils/logger/logger"

const BACKGROUND_NOTIFICATION_TASK_SMALL = "com.convos.background-notification-small"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function unregisterBackgroundNotificationTaskSmall() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK_SMALL)) {
      return TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK_SMALL)
    }
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Failed to unregister background notification task",
      }),
    )
  }
}

export async function registerBackgroundNotificationTaskSmall() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK_SMALL)) {
      return
    }

    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK_SMALL)
  } catch (error) {
    captureError(
      new NotificationError({
        error,
        additionalMessage: "Failed to register background notification task",
      }),
    )
  }
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK_SMALL, async ({ data, error }) => {
  try {
    logger.debug("BACKGROUND_NOTIFICATION_TASK_SMALL", { data, error })

    if (error || !data) {
      return
    }

    const message = extractBasicMessageData(data)

    authLogger.debug("message:", message)

    // We want to check if we can make a network call
    const appSettings = await getAppConfig()

    authLogger.debug("appSettings:", appSettings)

    if (message) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "New Message",
          body: "You received a new message",
        },
        trigger: null,
      })
    }
  } catch (error) {
    captureError(
      new NotificationError({ error, additionalMessage: "Error in background notification task" }),
    )
  }
})

function extractBasicMessageData(data: any) {
  // Simple extraction of message data
  if (data?.body?.contentTopic && data?.body?.encryptedMessage) {
    return {
      conversationTopic: data.body.contentTopic,
      encryptedMessage: data.body.encryptedMessage,
    }
  }

  return null
}
