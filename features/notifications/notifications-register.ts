import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { updateDevice } from "@/features/devices/devices.api"
import { ensureUserDeviceQueryData } from "@/features/devices/user-device.query"
import { requestNotificationsPermissions } from "@/features/notifications/notifications-permissions"
import {
  getDevicePushNotificationsToken,
  getExpoPushNotificationsToken,
} from "@/features/notifications/notifications-token"
import { registerNotificationInstallation } from "@/features/notifications/notifications.api"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { NotificationError, UserCancelledError } from "@/utils/error"

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
