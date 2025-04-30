import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { AppState } from "react-native"
import { getAppConfig } from "@/features/app-settings/app-settings.api"
import { getCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

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
    notificationsLogger.debug("BACKGROUND_NOTIFICATION_TASK_SMALL", { data, error })

    notificationsLogger.debug("AppState.currentState:", AppState.currentState)

    if (error || !data) {
      return
    }

    const message = extractBasicMessageData(data)

    notificationsLogger.debug("message:", message)

    // We want to check if we can make a network call
    const appSettings = await getAppConfig()

    notificationsLogger.debug("appSettings:", appSettings)

    const currentUser = getCurrentSender()

    if (!currentUser) {
      notificationsLogger.debug("No current user to show notification")
      return
    }

    await getXmtpClientByInboxId({ inboxId: currentUser.inboxId })

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
