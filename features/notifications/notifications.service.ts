import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { config } from "@/config"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { updateDevice } from "@/features/devices/devices.api"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { ensureNotificationsPermissions } from "@/features/notifications/notifications-permissions.query"
import { registerNotificationInstallation } from "@/features/notifications/notifications.api"
import { INotificationMessageConvertedData } from "@/features/notifications/notifications.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { NotificationError, UserCancelledError } from "@/utils/error"
import { notificationsLogger } from "@/utils/logger/logger"

export async function registerPushNotifications() {
  try {
    const result = await requestNotificationsPermissions()

    if (!result.granted) {
      throw new UserCancelledError({ error: "Notifications permissions not granted" })
    }

    const currentUser = await ensureCurrentUserQueryData({ caller: "registerPushNotifications" })

    if (!currentUser) {
      throw new NotificationError({
        error: "No current user found to register push notifications",
      })
    }

    const currentDevice = await ensureUserDeviceQueryData({
      userId: currentUser.id,
    })

    if (!currentDevice) {
      throw new NotificationError({
        error: "No current device found to register push notifications",
      })
    }

    const [deviceToken, expoToken] = await Promise.all([
      getDevicePushNotificationsToken(),
      getExpoPushNotificationsToken(),
    ])

    await updateDevice({
      userId: currentUser.id,
      deviceId: currentDevice.id,
      updates: {
        expoToken,
        pushToken: deviceToken,
      },
    })

    const currentSender = getSafeCurrentSender()
    const client = await getXmtpClientByInboxId({
      inboxId: currentSender.inboxId,
    })

    await registerNotificationInstallation({
      installationId: client.installationId,
      deliveryMechanism: {
        deliveryMechanismType: {
          case: "apnsDeviceToken",
          value: deviceToken,
        },
      },
    })
  } catch (error) {
    // Catch any error from the steps above and wrap it
    throw new NotificationError({
      error,
      additionalMessage: "Failed to register push notifications",
    })
  }
}

export async function getExpoPushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      throw new Error("Must use physical device for push notifications")
    }

    const data = await Notifications.getExpoPushTokenAsync({
      projectId: config.expo.projectId,
    })

    const expoToken = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Expo token:", expoToken)
    }

    return expoToken
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Failed to get Expo push token",
    })
  }
}

export async function getDevicePushNotificationsToken() {
  try {
    if (!Device.isDevice) {
      throw new Error("Must use physical")
    }

    let token

    const data = await Notifications.getDevicePushTokenAsync()

    // data.data is string for native platforms per DevicePushToken type
    // https://docs.expo.dev/versions/latest/sdk/notifications/#devicepushtoken
    token = data.data as string

    if (__DEV__) {
      notificationsLogger.debug("Device token:", token)
    }

    return token
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: "Error getting device push token",
    })
  }
}

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

export async function userHasGrantedNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.status === "granted"
}

export async function canAskForNotificationsPermissions() {
  const permission = await ensureNotificationsPermissions()
  return permission.canAskAgain
}

export function displayLocalNotification(args: Notifications.NotificationRequestInput) {
  return Notifications.scheduleNotificationAsync(args)
}

export async function clearNotificationsForConversation(args: {
  xmtpConversationId: IXmtpConversationId
}) {
  try {
    notificationsLogger.debug("Clearing notifications for conversation:", args.xmtpConversationId)

    // Get all current notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync()

    if (presentedNotifications.length === 0) {
      notificationsLogger.debug("No notifications to clear")
      return
    }

    // Find notifications related to this conversation
    const notificationsToRemove = presentedNotifications.filter((notification) => {
      // Check if notification has data and message
      const data = notification.request.content.data as
        | INotificationMessageConvertedData
        | undefined

      if (!data || !data.message) {
        return false
      }

      // Check if the message's conversation ID matches
      return data.message.xmtpConversationId === args.xmtpConversationId
    })

    if (notificationsToRemove.length === 0) {
      notificationsLogger.debug(
        `No notifications to clear found for conversation ${args.xmtpConversationId}`,
      )
      return
    }

    notificationsLogger.debug(
      `Found ${notificationsToRemove.length} notifications to clear for conversation ${args.xmtpConversationId}`,
    )

    // Dismiss each notification
    await Promise.all(
      notificationsToRemove.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    )

    notificationsLogger.debug(
      `Successfully cleared ${notificationsToRemove.length} notifications for conversation ${args.xmtpConversationId}`,
    )
  } catch (error) {
    throw new NotificationError({
      error,
      additionalMessage: `Failed to clear notifications for conversation ${args.xmtpConversationId}`,
    })
  }
}
