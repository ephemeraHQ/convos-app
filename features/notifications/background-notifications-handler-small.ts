import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { getAppConfig } from "@/features/app-settings/app-settings.api"

const BACKGROUND_NOTIFICATION_TASK = "com.convos.background-notification"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function unregisterBackgroundNotificationTaskSmall() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)) {
      return TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    }
  } catch (error) {
    console.error("Failed to unregister background notification task", error)
  }
}

async function registerBackgroundNotificationTask() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK)) {
      return
    }

    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
  } catch (error) {
    console.error("Failed to register background notification task", error)
  }
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  try {
    if (error || !data) {
      return
    }

    const message = extractBasicMessageData(data)

    console.log("message:", message)

    // We want to check if we can make a network call
    const appSettings = await getAppConfig()

    console.log("appSettings:", appSettings)

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
    console.error("Error in background notification task", error)
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
