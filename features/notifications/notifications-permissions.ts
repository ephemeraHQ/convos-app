import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"

export async function requestNotificationsPermissions(): Promise<{ granted: boolean }> {
  const permissions = await ensureNotificationsPermissions()

  // Permissions already granted
  if (permissions.status === "granted") {
    return { granted: true }
  }

  if (Platform.OS === "android") {
    // Android doesn't require explicit permission for notifications
    // Notification channels are set up in configureForegroundNotificationBehavior
    return { granted: true }
  }

  // If we can't ask again, return the current status without showing the prompt
  if (!permissions.canAskAgain) {
    return { granted: false }
  }

  // For iOS, show the permission request dialog
  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  })

  return { granted: result.status === Notifications.PermissionStatus.GRANTED }
}
