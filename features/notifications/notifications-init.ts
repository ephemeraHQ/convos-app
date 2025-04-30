import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { captureError } from "@/utils/capture-error"
import { NotificationError } from "@/utils/error"

export function configureForegroundNotificationBehavior() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }
    },
    handleError: (error, notificationId) => {
      captureError(
        new NotificationError({
          error,
          additionalMessage: `Failed to display notification ${notificationId}`,
        }),
      )
    },
  })

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      enableVibrate: true,
    }).catch(captureError)
  }
}
